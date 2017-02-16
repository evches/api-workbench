/// <reference path="../../../typings/main.d.ts" />

import _ = require("underscore")
import contextMenu = require("./contextMenu")
import commandManager = require("../quick-commands/command-manager")
import contextActions = require("@evches/raml-actions")
import path = require ('path')
import provider=require("../suggestion/provider")
import rp=require("@evches/raml-1-parser");
import search=rp.search;
import hl=rp.hl;
import ll=rp.ll;
import editorTools = require("../editor-tools/editor-tools")
import sharedAstInitializerInterfaces = require("../shared-ast-initializer-interfaces")

export type CommonASTStateCalculator = contextActions.CommonASTStateCalculator;

function initializeActionSupport() {

    contextActions.intializeStandardActions();
    contextActions.initializeActionBasedMenu('atom-text-editor[data-grammar="source raml"],.raml-outline');

    var editorCommandContributor : commandManager.ICommandContributor = {
        id : "editorContextActionContributor",


        calculateItems : function () {
            var currentActions = contextActions.calculateCurrentActions(
                contextActions.TARGET_RAML_EDITOR_NODE)

            if (!currentActions) return []

            var result : commandManager.ICommand[] = []

            currentActions.forEach(action => {
                result.push({

                    selector : 'atom-text-editor[data-grammar="source raml"],.raml-outline',

                    id : action.label ? action.label : action.name,

                    callBack: action.onClick
                })
            })

            return result
        }
    }

    commandManager.registerContributor(editorCommandContributor)
}

export function initialize(
    editorProvider : sharedAstInitializerInterfaces.IEditorProvider,
    astProvider : sharedAstInitializerInterfaces.IASTProvider,
    astModifier : sharedAstInitializerInterfaces.IASTModifier) {

    contextActions.setEditorProvider(editorProvider);

    contextActions.setASTProvider(<any>astProvider);

    contextActions.setASTModifier(<any>astModifier);

    initializeActionSupport();
}