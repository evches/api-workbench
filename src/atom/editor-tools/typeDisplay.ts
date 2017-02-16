/// <reference path="../../../typings/main.d.ts" />

import fs = require ('fs')
import path = require ('path')
import _=require("underscore")
import UI=require("atom-ui-lib")
import hl=require("@evches/raml-1-parser")
import def=hl.ds;

function findBuiltInValueType(type: def.IType) {
    if (type.isValueType() && type.isBuiltIn()) return type;

    var superTypes = type.allSuperTypes();
    if (superTypes == null || superTypes.length == 0) return null;

    return _.find(superTypes, superType=>(superType.isValueType() && superType.isBuiltIn()))
}

function getValueTypeDisplayName(type: def.IType) : string {

    var builtinValueType = findBuiltInValueType(type);
    if (!builtinValueType) type.nameId()?type.nameId() : "";

    if (builtinValueType.nameId() == "StringType") {
        return "string";
    } else if (builtinValueType.nameId() == "AnyType") {
        return "any";
    } else if (builtinValueType.nameId() == "NumberType") {
        return "number";
    } else if (builtinValueType.nameId() == "IntegerType") {
        return "integer";
    } else if (builtinValueType.nameId() == "NullType") {
        return "null";
    } else if (builtinValueType.nameId() == "TimeOnlyType") {
        return "time-only";
    } else if (builtinValueType.nameId() == "DateOnlyType") {
        return "date-only";
    } else if (builtinValueType.nameId() == "DateTimeOnlyType") {
        return "datetime-only";
    } else if (builtinValueType.nameId() == "DateTimeType") {
        return "datetime";
    } else if (builtinValueType.nameId() == "FileType") {
        return "file";
    } else if (builtinValueType.nameId() == "BooleanType") {
        return "boolean";
    } else if (builtinValueType.nameId() == "AnnotationTarget") {
        return "annotation target";
    }

    return builtinValueType.nameId()?builtinValueType.nameId() : "";
}

export function getTypeDisplayName(type: def.IType) : string {
    if (type == null) return "";

    if (type.isValueType()) {

        return getValueTypeDisplayName(type);
    } else if (type.hasArrayInHierarchy()) {

        var componentType = type.arrayInHierarchy().componentType();
        if (componentType && componentType.nameId()) {
            return getTypeDisplayName(componentType) + "[]";
        } else {
            return "array";
        }
    } else if (type.hasUnionInHierarchy()) {

        var asUnion = type.unionInHierarchy();

        return getTypeDisplayName(asUnion.leftType()) +
            " | " + getTypeDisplayName(asUnion.rightType());
    }

    return type.nameId()?type.nameId() : "";
}

var renderType = function (definition:def.IType):UI.UIComponent {
    var result = UI.vc();
    result.addChild(UI.label("definition:" + getTypeDisplayName(definition)))
    var elements = definition.properties();
    var superTypes = definition.superTypes();
    if (superTypes) {
        result.addChild(UI.h3("Super types:"));
        definition.allSuperTypes().forEach(x=> {
            result.addChild(UI.hc(UI.label(getTypeDisplayName(x), UI.Icon.TAG)));
        })
    }
    var rf=definition.getAdapter(def.RAMLService).getRepresentationOf();
    if (rf){
        var facets=rf.getFixedFacets();
        if (Object.keys(facets).length>0) {
            result.addChild(UI.h3("All facets"))
            Object.keys(facets).forEach(x=> {
                result.addChild(UI.label(x + ":" + facets[x].value()));
            })
        }
    }
    if (elements && elements.length > 0) {
        result.addChild(UI.h3("All properties"))
        elements.forEach(property=> {

            var propertyName = property.nameId();
            if (!property.isRequired()) {
                propertyName += "?"
            }

            result.addChild(
                UI.hc(UI.label(propertyName, UI.Icon.LINK),
                UI.label(": " + getTypeDisplayName(property.range()),
                UI.Icon.NONE, UI.TextClasses.WARNING)));
        })
    }
    if (definition.hasArrayInHierarchy()) {
        result.addChild(UI.h3("Component type:"))
        result.addChild(renderType(definition.arrayInHierarchy().componentType()))
    }

    if (definition.hasUnionInHierarchy()) {
        result.addChild(UI.h3("Union type:"))

        result.addChild(UI.h3("Left:"))
        result.addChild(renderType(definition.unionInHierarchy().leftType()))
        result.addChild(UI.h3("Right:"))

        result.addChild(renderType(definition.unionInHierarchy().rightType()))
    }
    return result;
};
export function render(node:hl.IHighLevelNode) {
    var wn = node.wrapperNode();
    var definition = wn.highLevel().localType();
    return renderType(definition);
}
