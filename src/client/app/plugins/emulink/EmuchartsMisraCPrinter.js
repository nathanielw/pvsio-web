/**
 * @author Gioacchino Mauro
 * @date Mon  7 Mar 2016 15:40:53 CET
 *
 * MISRA C code printer for emucharts models.
 * Emuchart objects have the following structure:
      emuchart = {
                name: (string),
                author: {
                    name: (string),
                    affiliation: (string),
                    contact: (string)
                },
                importings: (not used for now),
                constants: (array of {
                                name: (string), // the constant identifier
                                type: (string), // the constant type
                                value: (string) // the constant value (can be undefined)
                            }),
                variables: (array of {
                                name: (string), // the variable identifier
                                type: (string), // the variable type
                                scope: (string) // the variable scope, either local or global
                            }),
                states: (array of {
                                name: (string), // the state label
                                id: (string),   // a unique identifier
                            }),
                transitions: (array of {
                                name: (string), // the transition label
                                id: (string),   // a unique identifier
                                source: {
                                    name: (string), // the source state label
                                    id: (string)    // a unique identifier
                                },
                                target: {
                                    name: (string), // the target state label
                                    id: (string)    // a unique identifier
                                },
                            }),
                initial_transitions: (array of {
                                name: (string), // the initial transition label
                                id: (string),   // a unique identifier
                                target: {
                                    name: (string), // the target state label
                                    id: (string)    // a unique identifier
                                },
                            })
      }
 */
define(function (require, exports, module) {
    var makefileTemplate = require("text!plugins/emulink/models/misraC/templates/makefile.handlebars");
    var threadTemplate = require("text!plugins/emulink/models/misraC/templates/thread.handlebars");
    var headerTemplate = require("text!plugins/emulink/models/misraC/templates/header.handlebars");
    var mainTemplate = require("text!plugins/emulink/models/misraC/templates/main.handlebars");
    var doxygenTemplate = require("text!plugins/emulink/models/misraC/templates/doxygen.handlebars");
    var EmuchartsParser = require("plugins/emulink/EmuchartsParser");
    var displayNotificationView  = require("plugins/emulink/forms/displayNotificationView");
    var _parser = new EmuchartsParser();
    
    var displayNotification = function (msg, title) {
        title = title || "Notification";
        displayNotificationView.create({
            header: title,
            message: msg,
            buttons: ["Ok"]
        }).on("ok", function (e, view) {
            view.remove();
        });
    };
    var displayError = function (msg) {
        displayNotification(msg, "Compilation Error");
    };

    var machineStateType = "MachineState";
    var initialMachineState = "initialMachineState";
    var predefined_variables = {
        previous_state: { name: "previous_state", type: machineStateType, value: initialMachineState },
        current_state: { name: "current_state", type: machineStateType, value: initialMachineState }
    };
    var declarations = [];
    
    var operatorOverrides = {
        ":=": "=",
        "AND": "&&",
        "OR": "||",
        "NOT": "!",
        "MOD": "fmod",
        "and": "&&",
        "or": "||",
        "mod": "fmod",
        "not": "!",
        "=": "=="
    };
    
    var typeMaps = {
        "Time": "Time",    //Iachino: Serve??
        "bool": "UC_8",
        "char": "UC_8",
        "int": "UI_32",
        "float" : "F_32",
        "double": "D_64"                      
    };
    
    /**
     * Specific-length equivalents should be typedefd for the specific compile, with respect to MISRA 1998 rule (Rule 13, advisory)
     */   
    function getType(type) {
        if ( (type.toLowerCase() === "bool") || (type.toLowerCase() === "boolean") ) {
            type = typeMaps.bool;
            // if(!isInArray(declarations, "true")){  //Iachino: remove in case of decision to declare always boolean typedef
            //     declarations.push("#define true 1");
            //     declarations.push("#define false 0");
            //     declarations.push("#define TRUE 1");
            //     declarations.push("#define FALSE 0");
            //     declarations.push("typedef unsigned char " + type + ";");
            // }    
        }
        if (type.toLowerCase() === "char") { //The type char shall always be declared as unsigned char or signed char, with respect to MISRA 1998 rule (Rule 14, required)
            type = typeMaps.char;
            if(!isInArray(declarations, type)){
                declarations.push("typedef unsigned char " + type + ";");
            }
        }
        if (type.toLowerCase() === "int") {
            type = typeMaps.int;
            if(!isInArray(declarations, type)){
                declarations.push("typedef unsigned int " + type + ";");
            }
        }
        if (type.toLowerCase() === "float"){
            type = typeMaps.float;
            if(!isInArray(declarations, type)){
                declarations.push("typedef float " + type + ";");
            }
        }
        if ((type.toLowerCase() === "real") || (type.toLowerCase() === "double")){
            type = typeMaps.double;
            if(!isInArray(declarations, type)){
                declarations.push("typedef double " + type + ";");
            }
        }
        return typeMaps[type] || type;
    }
    
    /**
     * Set a number with the properly value's suffix, useful for parsing declaration's variable, with respect to MISRA 1998 rule (Rule 18, advisory)
     * Parameter is current value
     */
    function setSuffix(v) {
        if (isNumber(v.value)){
            if ( v.type.toUpperCase() === typeMaps.int ) {
                v.value = v.value + "u";
            }
            if ( (v.type.toUpperCase() === typeMaps.float) || (v.type.toUpperCase() === typeMaps.double) ){
                if (v.value.indexOf(".") === -1){
                    v.value = v.value + ".0f";
                }
                else{
                    v.value = v.value + "f";
                }
            }
        }
        return v.value;
    }
    
    /**
     * Set a number with the properly value's suffix, useful for parsing actions's transations, with respect to MISRA 1998 rule (Rule 18, advisory)
     * Parameters are variable definitions, current value to analize and emucharts structure
     */
    function setSuffixInActions(variable, val, emuchart) {
        emuchart.variables.local.map(function(z){
            if(variable.val.identifier.val === z.name){
                if ( z.type === typeMaps.int ) {
                    val += "u";
                }
                if ( (z.type === typeMaps.float) || (z.type === typeMaps.double) ){
                    if (val.indexOf(".") === -1){
                        val += ".0f";
                    }
                    else{
                        val += "f";
                    }
                }
            } 
        });
        return val;
    }
    
    /**
     * Change operator sintax from Emulink to C code
     */
    function getOperator(op, emuchart) {
        return operatorOverrides[op] || op;
    }
    
    /**
     * Check if a value is in an array
     * Return a boolean
     */
    function isInArray(array, search)
    {
        var arrayJoin = array.join();
        return arrayJoin.indexOf(search) >= 0;
    }
    
    /**
     * Check if a value is a float or a finite number
     * Return a boolean
     */
    function isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }
        
    /**
     * Check if a value is a local variable in the emuchart structure
     * Return a boolean
     */
    function isLocalVariable(name, emuchart) {
        if (name === predefined_variables.current_state.name ||
                name === predefined_variables.previous_state.name) {
            return true;
        }
        if (emuchart.variables && emuchart.variables.local) {
            var i = 0;
            for (i = 0; i < emuchart.variables.local.length; i++) {
                if (name === emuchart.variables.local[i].name) {
                    return true;
                }
            }
        }
        return false;
    }
    // function isInputVariable(name, emuchart) {
    //     if (emuchart.variables && emuchart.variables.input) {
    //         var i = 0;
    //         for (i = 0; i < emuchart.variables.input.length; i++) {
    //             if (name === emuchart.variables.input[i].name) {
    //                 return true;
    //             }
    //         }
    //     }
    //     return false;
    // }
    // function isOutputVariable(name, emuchart) {
    //     if (emuchart.variables && emuchart.variables.output) {
    //         var i = 0;
    //         for (i = 0; i < emuchart.variables.output.length; i++) {
    //             if (name === emuchart.variables.output[i].name) {
    //                 return true;
    //             }
    //         }
    //     }
    //     return false;
    // }
    
    /**
     * Check if a value is a constant in the emuchart structure
     * Return a boolean
     */
    function isConstant(name, emuchart) {
        if (emuchart.constants) {
            var i = 0;
            for (i = 0; i < emuchart.constants.length; i++) {
                if (name === emuchart.constants[i].name) {
                    return true;
                }
            }
        }
        return false;
    }
    
    function parseTransition(t, emuchart) {
        function getExpression(expression, emuchart) {
            var complexActions = ["expression", "assignment", "function"];
            if (expression === undefined || expression === null) {
                return "";
            }
            if (expression.type === 'modop'){             //managing modulus operator in condition forms, it's valid only for integer values
                expression.val = '%';
            }
            if (Array.isArray(expression.val)){             //managing modulus operator in expression forms
                var i,j;
                for ( i = 0; i < expression.val.length; i++){
                    if (expression.val[i].type === 'modop'){
                        if(!isInArray(declarations, "#include <math.h>")){
                            declarations.push("#ifndef MATH_H");
                            declarations.push("#define MATH_H");
                            declarations.push("#include <math.h>");
                            declarations.push("#endif");
                        }
                        var lpar = 0;
                        var rpar = 1;
                        for ( j = i; j >= 0; j--){
                            if ( expression.val[j].val === '(')
                                lpar++;
                            if ( expression.val[j].val === ')')
                                rpar++;
                            if ( lpar === rpar ){  
                                var tmp = new Object();
                                tmp.type = "builtin";
                                tmp.val = ",";
                                expression.val.splice(j, 0, expression.val[i]);       //swap modulus operator
                                expression.val.splice(i+1, 1, tmp); 
                                break;
                            }
                        }
                    }
                }
            }
            if (expression.type === "assignment") {
                var name = expression.val.identifier.val;
                expression.val.expression.val.map(function (v) {
                    if (v.type === "identifier"){
                        if(isLocalVariable(v.val, emuchart)) {
                            v.val = "st->" + v.val;
                        }else if (!isConstant(v.val, emuchart)){
                                v.val = "st->"+ v.val;          //same of before but leave intentionally in case of different choise
                        }
                    }
                    return;
                });
                if (isLocalVariable(name, emuchart)) {
                    return "st->" + name + " = " +
                            getExpression(expression.val.expression, emuchart);                
                }
                return "st->" + name + " = " +
                        getExpression(expression.val.expression, emuchart);
            } else {
                if (expression.type === 'identifier'){
                    if(isLocalVariable(expression.val, emuchart)) {
                            expression.val = "st->" + expression.val;
                        }else if (!isConstant(expression.val, emuchart)){
                            expression.val = "st->"+ expression.val;        //same of before but leave intentionally in case of different choise
                        }
                }
                if (Array.isArray(expression.val)) {
                    var res = expression.val.map(function (token) {
                        if (complexActions.indexOf(token.val) > -1) {
                            return getExpression(token.val, emuchart);
                        } else {
                            return getOperator(token.val, emuchart);
                        }
                    });
                    return res.join(" ");
                } else {
                    if (complexActions.indexOf(expression.val) > -1) {
                        return getExpression(expression.val, emuchart);
                    } else {
                        return getOperator(expression.val, emuchart);
                    }
                }
            }
        }        
        var name = t.name;
        var functionBody = _parser.parseTransition(name);
        if (functionBody.res) {
            functionBody = functionBody.res.val;
            var id = functionBody.identifier;
            var condition = functionBody.cond;
            var actions = functionBody.actions;
            if (condition) {
                condition = condition.val.map(function (token) {
                    return getExpression(token, emuchart);
                }).join(" ");
            }
            if (actions) {
                actions = actions.val.map(function (a) {
                    a.val.expression.val.map(function(b){
                        if(b.type === "number"){
                            b.val = setSuffixInActions(a, b.val, emuchart);                         
                        }
                    });
                    return getExpression(a, emuchart);
                });
            }
            return {id: id.val, actions: actions, condition: condition, source: t.source, target: t.target, sources: [], targets: []};
        } else if (functionBody.err) {
            displayError(functionBody.err);
            return { erroneousLabel: name, parserError: functionBody.err };
        }
    }
    
    function Printer(name) {
        this.modelName = name;
        this.model = {modelName: name, transitions: []};
    }

    Printer.prototype.constructor = Printer;

    Printer.prototype.print_variables = function (emuchart) {
        if (emuchart.variables) {
            this.model.input_variables = emuchart.variables.input.map(function (v) {
                if (v.type.toLowerCase() === "char") {
                    v.value = "\"" + v.value + "\"";
                    v.type = getType(v.type);
                    return v;
                }
                v.type = getType(v.type);
                v.value = setSuffix(v);
                return v;
            });
            this.model.output_variables = emuchart.variables.output.map(function (v) {
                if (v.type.toLowerCase() === "char") {
                    v.value = "\"" + v.value + "\"";
                    v.type = getType(v.type);
                    return v;
                }
                v.type = getType(v.type);
                v.value = setSuffix(v);
                return v;
            });
            this.model.local_variables = emuchart.variables.local.map(function (v) {
                if (v.type.toLowerCase() === "char") {
                    v.value = "\"" + v.value + "\"";
                    v.type = getType(v.type);
                    return v;
                }
                v.type = getType(v.type);
                v.value = setSuffix(v);
                return v;
            });
        }
    };

    Printer.prototype.print_constants = function (emuchart) {
        this.model.constants = emuchart.constants.map(function (v) {
            if (v.type.toLowerCase() === "char") {
                v.value = "\"" + v.value + "\"";
                v.type = getType(v.type);
                return v;
            }
            else{
                v.type = getType(v.type);
                v.value = setSuffix(v);
            }
            return v;
        });
    };

    Printer.prototype.print_declarations = function (emuchart) {
        /* Adding initial declarations, always useful to manage boolean variables */
        declarations.push("typedef unsigned char " + typeMaps.bool + ";");
        declarations.push("#define true 1");
        declarations.push("#define false 0");
        declarations.push("#define TRUE 1");
        declarations.push("#define FALSE 0");
        this.model.importings = declarations;
        if (emuchart.variables) {
            this.model.structureVar = emuchart.variables.local.map(function (v) {
                v.type = getType(v.type);
                return (v.type + " "+ v.name + ";");
            });
        }
        this.model.structureVar.push(machineStateType + " " + predefined_variables.current_state.name + ";  ///<  Predefined variable for current state.");
        this.model.structureVar.push(machineStateType + " " + predefined_variables.previous_state.name + ";  ///<  Predefined variable for previous state.");
    };
    
    Printer.prototype.print_transitions = function (emuchart) {
        var transitions = [];
        var functionsName = [];
        emuchart.transitions.forEach(function (t) {
            var parsedTransition  = parseTransition(t, emuchart);
            if (parsedTransition) {
                 if(!isInArray(functionsName, parsedTransition.id)){
                     functionsName.push(parsedTransition.id);
                     transitions.push(parsedTransition);
                 }
                 else{                 
                     var i;
                     for ( i = 0; i < transitions.length; i++){
                         if(transitions[i].id !== 'undefined'){
                            if(!transitions[i].sources){                            //control in transictions list
                                if(!isInArray(transitions[i][0].sources, parsedTransition.source.name) && (transitions[i][0].id === parsedTransition.id)){   //it checks if there are different sources in transitions
                                    transitions[i][0].sources.push(parsedTransition.source.name);
                                }
                            }
                            else{                                                   //control in transictions innested list
                                if(!isInArray(transitions[i].sources, parsedTransition.source.name) && (transitions[i].id === parsedTransition.id)){         //it checks if there are different sources in transitions
                                    transitions[i].sources.push(parsedTransition.source.name);
                                }
                            }
                            if(!transitions[i].targets){                            //control in transictions list
                                if(!isInArray(transitions[i][0].targets, parsedTransition.target.name) && (transitions[i][0].id === parsedTransition.id)){   //it checks if there are different targets in transitions
                                    transitions[i][0].targets.push(parsedTransition.target.name);
                                }
                            }
                            else{                                                   //control in transictions innested list
                                if(!isInArray(transitions[i].targets, parsedTransition.target.name) && (transitions[i].id === parsedTransition.id)){         //it checks if there are different targets in transitions
                                    transitions[i].targets.push(parsedTransition.target.name);
                                }
                            }
                            if (transitions[i].id === parsedTransition.id){
                                var tmp = [];
                                tmp.push(transitions[i]);
                                tmp.push(parsedTransition);
                                transitions[i] = tmp;
                            }
                            else{
                                var j;
                                for (j = 0; j < transitions[i].length; j++){
                                    if (transitions[i][j].id === parsedTransition.id){
                                        var tmp = [];
                                        transitions[i].map(function (v) {
                                            tmp.push(v);
                                            return;
                                        });
                                        tmp.push(parsedTransition);
                                        transitions[i] = tmp;
                                        break;
                                    }
                                }
                            }
                         }
                     }
                 }
            }
        });
        if (transitions) {
            this.model.transitions = this.model.transitions.concat(transitions);
        }
    };
    
    Printer.prototype.print_initial_transition = function (emuchart) {
        var initial_transitions = emuchart.initial_transitions,
            i = 0,
            transitions = [];
        initial_transitions.forEach(function (t) {
            var parsedInit = parseTransition(t, emuchart);
            if (parsedInit) {
                transitions.push(parsedInit);
            }
        });
        if (transitions) {
            this.model.initial_transitions = transitions;
        }
    };
    

    Printer.prototype.print_types = function (emuchart) {
    };

    Printer.prototype.print_states = function (emuchart) {
        this.model.states = emuchart.states;
    };
    
    Printer.prototype.print_descriptor = function (emuchart) {
        this.model.descriptor = 
            "/**---------------------------------------------------------------" +
            "\n*   Model: " + emuchart.name;
        Handlebars.registerHelper('filename', function() {
                return emuchart.name;
        });
        if (emuchart.author) {
            this.model.descriptor += 
                "\n*   Author: " + emuchart.author.name +
                "\n*           " + emuchart.author.affiliation +
                "\n*           " + emuchart.author.contact;
        }
        if (emuchart.description) {
            this.model.descriptor += 
                "\n*  ---------------------------------------------------------------" +
                "\n*   " + emuchart.description;
        }
        this.model.descriptor += 
            "\n*  ---------------------------------------------------------------*/\n";
        this.model.makefile_descriptor = this.model.descriptor.replace(/\*|\//g,'#');
    };
    
    Printer.prototype.print_disclaimer = function (emuchart) {
        this.model.disclaimer = "\n/** ---------------------------------------------------------------\n" +
                    "*   C code generated using PVSio-web MisraCPrinter ver 0.1\n" +
                    "*   Tool freely available at http://www.pvsioweb.org" +
                    "\n*  --------------------------------------------------------------*/\n";
        this.model.makefile_disclaimer = this.model.disclaimer.replace(/\*|\//g,'#');
        this.model.makefile_disclaimer = this.model.makefile_disclaimer.replace(/C code/g, "Makefile");
    };

    Printer.prototype.print = function (emuchart) {
        this.model.transitions = [];
        this.print_variables(emuchart);
        this.print_declarations(emuchart);
        this.print_constants(emuchart);
        this.print_transitions(emuchart);
        this.print_initial_transition(emuchart);
        this.print_states(emuchart);
        this.print_disclaimer(emuchart);
        this.print_descriptor(emuchart);
        
        console.log(this.model);//Iachino: TO debug
        
        var makefile = Handlebars.compile(makefileTemplate)(this.model);
        var thread = Handlebars.compile(threadTemplate)(this.model);
        var header = Handlebars.compile(headerTemplate)(this.model);
        var main = Handlebars.compile(mainTemplate)(this.model);
        var doxygen = Handlebars.compile(doxygenTemplate)(this.model);
        declarations = [];
        return {makefile: makefile, thread: thread, header: header, main: main, doxygen: doxygen};
    };

    module.exports = Printer;
});
