/// <reference path="../../../typings/main.d.ts" />

import fs = require ('fs')
import path = require ('path')
import hl=require("@evches/raml-1-parser")
import _=require("underscore")
import UI=require("atom-ui-lib")
import editorTools=require("../editor-tools/editor-tools")
import extract=require("./extractElementsDialog")
import assist=require("./assist-utils")
var universes=hl.universes;

export class MoveElementsDialog{

    constructor(private node:hl.IHighLevelNode,private name:string,private _resourceType:boolean){

    }

    private getActiveEditor() {
        var activeEditor = atom.workspace.getActiveTextEditor()
        if (activeEditor) {
            return activeEditor
        }

        if (editorTools.aquireManager())
            return <AtomCore.IEditor>editorTools.aquireManager().getCurrentEditor()

        return null
    }

    show(){
        var zz:any=null;
        var node=this.node;
        var vc=UI.section("Move resource ",UI.Icon.GIST_NEW,false,false);
        var errorLabel=UI.label("please select destination resource",UI.Icon.BUG,UI.TextClasses.ERROR,UI.HighLightClasses.NONE);
        vc.addChild(UI.vc(errorLabel));
        vc.addChild(UI.label("Please select destination resource"));
        var el=UI.hc();
        vc.setPercentWidth(100);
        el.setPercentWidth(100);
        var filterFunc=(x:hl.IHighLevelNode)=>{
            if(this._resourceType) {
                if (x.definition().key()!=universes.Universe08.Resource &&
                    x.definition().key()!=universes.Universe10.Resource) {
                    return false;
                }

                if (x==node || x == node.parent()){
                    return false;
                }


            }
            return true;
        };
        var universe=node.definition().universe();

        var v=extract.createSmallSelectionPanel(node.root(),filterFunc,"400px","100%");

        el.addChild(v);
        vc.addChild(el);
        v.addSelectionListener({

            selectionChanged:(ev:UI.SelectionChangedEvent<any>)=> {
                errorLabel.setDisplay(ev.selection.isEmpty())
                okButton.setDisabled(ev.selection.isEmpty());
            }
        });
        var buttonBar=UI.hc().setPercentWidth(100).setStyle("display","flex");
        buttonBar.addChild(UI.label("",null,null,null).setStyle("flex","1"))
        buttonBar.addChild(UI.button("Cancel",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.NO_HIGHLIGHT,UI.Icon.NONE,x=>{zz.destroy()}).margin(10,10))
        var okButton=UI.button("Move",UI.ButtonSizes.NORMAL,UI.ButtonHighlights.SUCCESS,UI.Icon.NONE,x=>{
            var target = (<any>v.getSelection().elements[0]);
            node.parent().remove(node);
            target.add(node);
            var rs=node.lowLevel().unit().contents();
            this.getActiveEditor().setText(assist.cleanEmptyLines(rs));
            zz.destroy();
        });
        okButton.setDisabled(true)
        buttonBar.addChild(okButton);
        vc.addChild(buttonBar)
        var html=vc.renderUI();
        zz=(<any>atom).workspace.addModalPanel( { item: html});
        html.focus();
    }


}
