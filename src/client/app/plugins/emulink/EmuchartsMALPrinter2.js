/** @module EmuchartsMALPrinter */
/**
 * EmuchartsMALPrinter provides functions to generate MAL models from Emucharts
 * @authors: Paolo Masci, Rui Couto
 * @date 2014/22/10 11:00:21 AM
 *
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
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3 */
define(function (require, exports, module) {
	"use strict";
    
    var EmuchartsParser = require("plugins/emulink/EmuchartsParser");
    
    var model_name;
    var parser;
    
    /**
	 * Constructor
	 */
    function EmuchartsMALPrinter(name) {
        model_name = name;
        parser = new EmuchartsParser();
        return this;
    }
    
    /**
     * Prints MAL types
     */
    EmuchartsMALPrinter.prototype.print_types = function (emuchart) {
        var ans = "types\n";
        ans += " int = INT_MIN..INT_MAX\n";
        ans += " nat = 0..INT_MAX\n";
        if (emuchart.states && emuchart.states.length > 0) {
            ans += " MachineState = { ";
            var i = 0;
            while (i < emuchart.states.length) {
                ans += emuchart.states[i].name;
                if (i < emuchart.states.length - 1) { ans += ", "; }
                i++;
            }
            ans += " }\n";
        }
        return ans + "\n";
    };
    

    /**
     * Parser for transitions given in the form name [ condition ] { actios },
     * where name is the transition name, and conditions and actions are optionals
     * @returns a transition object with the following structure: 
     *                  { name: string, // the transition label
     *                    cond: string, // represents a boolean expression
     *                    actions: (array of strings), // each action represents a state update
     *                    from: (string), // source state label
     *                    to: (string) // target state label }
     */
    function parseTransition(transition) {
        var ans = {
            name: "",
            cond: "",
            actions: [],
            from: (transition.source) ? transition.source.name : null,
            to: transition.target.name
        };
        function parseTransitionName(transition) {
            var pos = transition.indexOf("[");
            if (pos > 0) { return transition.substr(0, pos).trim(); }
            pos = transition.indexOf("{");
            if (pos > 0) { return transition.substr(0, pos).trim(); }
            return transition.trim();
        }
        var sqOpen = transition.name.indexOf("[");
        var sqClose = transition.name.indexOf("]");
        var curOpen = transition.name.indexOf("{");
        var curClose = transition.name.indexOf("}");
        ans.name = parseTransitionName(transition.name);
        if (sqOpen >= 0 && sqClose > sqOpen) {
            ans.cond = transition.name.substring(sqOpen + 1, sqClose).trim();
        }
        if (curOpen >= 0 && curClose > curOpen) {
            var actions = transition.name.substring(curOpen + 1, curClose).split(";");
            actions.forEach(function (action) {
                var a = action.trim();
                if (a !== "") {
                    ans.actions.push(a);
                }
            });
            
        }
        return ans;
    }



    /**
     * Prints MAL axioms
     */
    EmuchartsMALPrinter.prototype.print_axioms = function (emuchart) {
        var ans = "";
        //.... TODO
        return ans;
    };
    
    /**
     * Prints MAL actions
     * Each transition is a structure with the following fields:
     *                  { name: string, // the transition label
     *                    cond: string, // represents a boolean expression
     *                    actions: (array of strings), // each action represents a state update
     *                    from: (string), // source state label
     *                    to: (string) // target state label }
     */
    EmuchartsMALPrinter.prototype.print_actions = function (emuchart) {
        var ans = " actions\n";
        var actions = d3.set();
        
        if (emuchart.transitions && emuchart.transitions.length > 0) {
            emuchart.transitions.forEach(function (t) {
                var transition = parseTransition(t);
                if (!actions.has(transition.name)) {
                    ans += "  " + transition.name + "\n";
                    actions.add(transition.name);
                }
                // first, generate the permission
                
            });
        }
        ans += "\n";
        return ans;
    };

    /**
     * Prints MAL initial transition
     * Each transition is a structure with the following fields:
     *                  { name: string, // the transition label
     *                    cond: string, // represents a boolean expression
     *                    actions: (array of strings), // each action represents a state update
     *                    to: (string) // target state label }
     */
    EmuchartsMALPrinter.prototype.print_initial_transition = function (emuchart) {
        var ans = "";
        if (emuchart.initial_transitions && emuchart.initial_transitions.length > 0) {
            emuchart.initial_transitions.forEach(function (t) {
                var transition = parseTransition(t);
                ans += " [] ";
                ans += "previous_state = " + transition.to + " & ";
                ans += "current_state = " + transition.to;
                transition.actions.forEach(function (action) {
                    ans += " & " + action;
                });
            });
        }
        ans += "\n\n";
        return ans;
    };

    /**
     * Prints MAL transitions
     * Each transition is a structure with the following fields:
     *                  { name: string, // the transition label
     *                    cond: string, // represents a boolean expression
     *                    actions: (array of strings), // each action represents a state update
     *                    from: (string), // source state label
     *                    to: (string) // target state label }
     */
    /* 
    EmuchartsMALPrinter.prototype.print_transitions = function (emuchart) {
        var ans = "";
        if (emuchart.transitions && emuchart.transitions.length > 0) {
            var visitedTransitions = d3.map();
            emuchart.transitions.forEach(function (t) {
                var transition = parseTransition(t);
                if (visitedTransitions.has(transition.name) === false) {
                    visitedTransitions.set(transition.name, true);
                    // first, print the permission
                    ans += " per(" + transition.name + ") ->";
                    ans += " current_state = " + transition.from;
                    
                    // second, print the transition conditions, if any
                    var trans;
                    emuchart.transitions.forEach(function (t) {
                        trans = parseTransition(t);
                        if (trans.name === transition.name && trans.cond && trans.cond !== "") {
                            ans += " & " + trans.cond;
                        }
                    });
                    // third, print the transition name
                    ans += "\n [" + transition.name + "]";
                    ans += " -> previous_state' = " + transition.from;
                    ans += " & current_state' = " + transition.to;
                    // finally, print the transition body
                    transition.actions.forEach(function (action) {
                        ans += " & " + action;
                    });
                    ans += "\n\n";
                }
            });
        }
        ans += "\n";
        return ans;
    };
    */
    
    EmuchartsMALPrinter.prototype.print_transitions = function (emuchart) {
        var res = "";
        var actions = d3.map();
        console.log("PROCESS START:");
        emuchart.transitions.forEach(function (mLabel) {
            var label = mLabel.name;
            var from = mLabel.source.name;
            var to = mLabel.target.name;
                        
            if (!label || label === "") {
                return { err: "Unexpected label", res: null };
            }
            var ans = parser.parseTransition(label);
            //res += JSON.stringify(ans) + "\n";
            if (ans.res) {
                var transition = {
                    identifier: ans.res.val.identifier || { type: "identifier", val: "tick" },
                    cond:       ans.res.val.cond || { type: "expression", val: [] },
                    actions:    ans.res.val.actions || { type: "actions", val: [] }
                };
                                
                var action = transition.identifier.val;
                
                var effect = "";
                if (transition.actions.val.length > 0) {
                    effect += transition.actions.val[0].val.identifier.val;
                    effect += transition.actions.val[0].val.binop.val;
                    //effect += JSON.stringify(transition.actions.val[0].val.expression.val)+"\n";
                    transition.actions.val[0].val.expression.val.forEach(function (v) {
                        effect +=v.val;
                    });
                    /*
                
                    effect += transition.actions.val[0].val.identifier.val;
                    effect += transition.actions.val[0].val.binop.val === ":=" ? "'=" : transition.cond.val[1].val;
                    effect += transition.actions.val[0].val.expression.val;*/
                }
                
                var cond = "";
                if (transition.cond.val.length > 0) {
                    cond += transition.cond.val[0].val;
                    cond += transition.cond.val[1].val === "==" ? "=" : transition.cond.val[1].val;
                    cond += transition.cond.val[2].val;
                }
                
                //Create pair (to, condition) -- Transition
                console.log("Transition: " + from + "," + to);
                var mtransition = d3.map();
                var ce = [];
                ce.push(cond);
                ce.push(effect);
                mtransition.set(to, ce);
                
                //Create pair (from, [<Transition>]) --Condition
                console.log("Value: (transition), " + cond);
                var mval = d3.map();
                var a = [];
                console.log("Checking" + from);
                if (actions.get(action) !== undefined && actions.get(action).has(from)) {
                    console.log("*Existing " + from);
                    a = actions.get(action).get(from);
                }
                a.push(mtransition);
                console.log("pushing" + mtransition);
                mval.set(from, a);
                
                //creating pair (action, <Condition>)
                console.log("Action: " + action + ", (value)");
                actions.set(action, mval);
            }
        });
        //actions contains set (action, (from, [(to, condition)]))
        //
        //rcButton - stopped -> opening, memory=opening
        //                   -> closing, memory=closing
        //opSensor - opening -> open, ""
        //click_on - closed  -> opening, display=100
        //
        /*
        actions.keys().forEach(function (taction) { //action name
            res += "+" + taction + "\n";
            // mval             | mtransition
            actions.get(taction).keys().forEach(function (mtra) { // [mtransition]
                res += " +" + mtra + "\n";
                actions.get(taction).get(mtra).forEach(function (v) {
                    v.forEach(function (nv) {
                        res += "  +" + nv + "\n";
                        res += "   +" + v.get(nv) + "\n";
                    });
                    
                });
                
                
            });
        });*/
        
        actions.keys().forEach(function (taction) { //action name
            var trAction = taction;
            //res += "+" + taction + "\n";
            // mval             | mtransition
            actions.get(taction).keys().forEach(function (mtra) { // [mtransition]
                var trFrom = mtra;
                //res += " +" + mtra + "\n";
                actions.get(taction).get(mtra).forEach(function (v) {
                    v.forEach(function (nv) {
                        var trDest = nv;
                        var trCond = v.get(nv)[0];
                        var trEff = v.get(nv)[1];
                        //res += "  +" + nv + "\n";
                        //res += "   +" + v.get(nv) + "\n";
                        res += "(current_state=" + trFrom + ")";
                        if (trCond !== "") {
                            res += " & (" + trCond + ")";
                        }
                        res += " -> [" + taction + "] (current_state'=" + trDest + ")";
                        if (trEff !== "") {
                            res += " & (" + trEff + ")";
                        }
                        
                        
                        res += "\n";
                    });
                    
                });
                
                
            });
        });
        
        
                
        return res;
    };
    
    /**
     * Prints MAL attributes
     */
    EmuchartsMALPrinter.prototype.print_attributes = function (emuchart) {
        var ans = " attributes\n";
        ans += "  current_state: MachineState\n";
        ans += "  previous_state: MachineState\n";
        if (emuchart.variables && emuchart.variables.length > 0) {
            emuchart.variables.forEach(function (v) {
                ans += v.name + ": " + v.type + "\n";
            });
        }
        ans += "\n";
        return ans;
    };

    /**
     * Prints MAL constants
     */
    EmuchartsMALPrinter.prototype.print_constants = function (emuchart) {
        var constants = emuchart.constants;
        var ans = "defines\n";
        ans += " INT_MIN = -4\n";
        ans += " INT_MAX = 4\n";
        if (constants && constants.length > 0) {
            constants.forEach(function (c) {
                if (c.value) {
                    ans += c.name + " " + c.value + "\n";
                } else {
                    ans += "# " + c.name + "\n";
                }
            });
        }
        ans += "\n";
        return ans;
    };


    EmuchartsMALPrinter.prototype.print_descriptor = function (emuchart) {
        var ans = "# ---------------------------------------------------------------\n" +
                    "#  MAL Model: " + emuchart.name;
        if (emuchart.author) {
            ans += "\n#  Author: " + emuchart.author.name +
                    "\n#          " + emuchart.author.affiliation +
                    "\n#          " + emuchart.author.contact;
        }
        if (emuchart.description) {
            ans += "\n# ---------------------------------------------------------------" +
                    "\n#  " + emuchart.description;
        }
        ans += "\n# ---------------------------------------------------------------\n";
        return ans;
    };
    
    EmuchartsMALPrinter.prototype.print_disclaimer = function () {
        var ans = "\n# ---------------------------------------------------------------\n" +
                    "#  MAL model generated using PVSio-web MALPrinter2 ver 0.1\n" +
                    "#  Tool freely available at http://www.pvsioweb.org" +
                    "\n# ---------------------------------------------------------------\n";
        return ans;
    };
    
    /**
     * Prints the entire MAL model
     */
    EmuchartsMALPrinter.prototype.print = function (emuchart) {
        var ans = this.print_descriptor(emuchart) + "\n";
        ans += this.print_constants(emuchart); // "defines" section
        ans += this.print_types(emuchart); // "types" section
        
        //ans += "interactor " + emuchart.name + "\n"; // the MAL interactor
        ans += "interactor main #" + emuchart.name + "\n";
        ans += this.print_attributes(emuchart); // MAL attributes
        ans += this.print_actions(emuchart);
        
        ans += this.print_initial_transition(emuchart);
        ans += this.print_transitions(emuchart);
        ans += "\n";
        ans += this.print_disclaimer();
        return ans;
    };
    
    module.exports = EmuchartsMALPrinter;
});