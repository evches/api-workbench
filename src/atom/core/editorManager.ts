/**
 * Created by kor on 24/07/15.
 */
/// <reference path="../../../typings/main.d.ts" />

import fs = require ('fs')
import path = require ('path')
import editorTools=require("../editor-tools/editor-tools")
import rp=require("@evches/raml-1-parser")
import project=rp.project;

export function ast(editor:AtomCore.IEditor):rp.IHighLevelNode{
    var man=editorTools.aquireManager();
    if (editorTools.aquireManager()){
        if (man.getCurrentEditor()==editor){
            return man.ast;
        }
    }
    var p=editor.getPath();
    var prj=project.createProject(path.dirname(p));
    var unit=prj.unit(path.basename(p));
    var text=editor.getBuffer().getText();
    if (!unit){
        return null;
    }
    unit.updateContent(text);
    var ast=<rp.IHighLevelNode>unit.highLevel();
    return ast;
}
