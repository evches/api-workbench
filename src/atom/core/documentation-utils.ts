/// <reference path="../../../typings/main.d.ts" />
import path = require('path');
import rp=require("@evches/raml-1-parser")
import lowLevel=rp.ll;
import hl=rp.hl;

import _=require("underscore")
import search=rp.search;
import services = rp.ds

export function getDocumentation(node:hl.IHighLevelNode,pos:number):string{
    var attr=_.find(node.attrs(),x=>x.lowLevel().start()<pos&&x.lowLevel().end()>=pos&&!x.property().getAdapter(services.RAMLPropertyService).isKey());
    if (!attr){
        var txt=node.lowLevel().unit().contents();
        var c=search.determineCompletionKind(txt,pos);
        if (c==search.LocationKind.KEY_COMPLETION){
            //lets calculate key;
            var lb=0;
            var rb=0;
            for (var i=pos;i>=0;i--){
                if (txt[i]==' '||txt[i]=='\r'||txt[i]=='\t'||txt[i]=='\n'){
                    lb=i+1;
                    break;
                }
            }
            for (var i=pos;i<txt.length;i++){
                if (txt[i]==':'){
                    rb=i;
                    break;
                }
            }
            if (lb&&rb){
                var name=txt.substring(lb,rb);
                var prop=node.definition().property(name);
                if(prop){
                    var pr=prop.description().split("\n");
                    var text=pr.join("<br/>")
                    return (`<h5>Property:${prop.nameId()}</h5>`+"<div>"+text+"</div>")

                }
            }
        }
    }
    if (attr){
        var pr=attr.property().description().split("\n");
        var text=pr.join("<br/>")
        return (`<h5>Property:${attr.property().nameId()}</h5>`+"<div>"+text+"</div>")
    }
    else {
        var prs=node.definition().description().split("\n");
            var kp=_.find(node.definition().allProperties(),x=>x.getAdapter(services.RAMLPropertyService).isKey())
            if (kp){
                var vp=kp.getAdapter(services.RAMLPropertyService).valueDocProvider();
                if(vp){
                    var s= vp(node.name());
                    if (s){
                        prs.push(s);
                    }
                }
                //if (kp.val)
            }
        var text=prs.join("<br/>")
        return (`<h5>Node:${node.definition().nameId()}</h5>`+"<div>"+text+"</div");
    }
}
