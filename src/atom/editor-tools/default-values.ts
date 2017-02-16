/// <reference path="../../../typings/main.d.ts" />

import hl=require("@evches/raml-1-parser");
import ds=hl.ds;
var universe=ds.universesInfo

export function getDefaultValue(node: hl.IHighLevelNode, property: hl.IProperty) {
    if(property.nameId() === <string>universe.Universe10.TypeDeclaration.properties.required.name) {
        return node.name().indexOf("?") !== node.name().length - 1;
    }
}

export function hasDefault(property: hl.IProperty) {
    if(property.nameId() === <string>universe.Universe10.TypeDeclaration.properties.required.name) {
        return true;
    }
    return false;
}