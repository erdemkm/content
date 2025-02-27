
function convertValue(args, type, value) {
    if (type === undefined || type === null || type == "raw") {
        // nop: type == "raw"
    } else if (type == "value") {
        value = args.value;
    } else if (type == "json") {
        value = JSON.parse(value);
    } else {
        throw `Unknown value type: ${type}`;
    }
    return value === undefined ? null : value;
}

function getValue(args, condition, options, lhs, getValueArray) {
    for (var name of getValueArray) { // descending order by length
        if (lhs ? condition.startsWith(name) : condition.endsWith(name)) {
            return [name, convertValue(args, options[`input_data_type:${name}`], args[name])];
        }
    }
    throw `Invalid condition: ${condition}`;
}

function makeOptions(option_names) {
    var options = {};
    for (var name of argToList(option_names ? option_names : "")) {
        name = name.trim();
        var seppos = name.lastIndexOf("=");
        var value = true;
        if (seppos >= 0){
            value = name.substr(seppos+1);
            name = name.substr(0, seppos);
        }
        if (!name) {
            throw "Found an empty name in options.";
        }
        options[name] = value;
    }
    return options;
}

function getOperator(lhs_name, rhs_name, condition) {
    var operator = condition.substr(
        lhs_name.length,
        condition.length - lhs_name.length - rhs_name.length);

    const specials = [" ", "!", "=", "~", "<", ">"];
    if (specials.indexOf(operator.slice(0, 1)) < 0 ||
        specials.indexOf(operator.slice(-1)) < 0 ){
        throw `Invalid condition: ${condition}`;
    }
    return operator.trim();
}

function lowerIfPossible(lhs, rhs, case_insensitive) {
    if (case_insensitive && typeof lhs == "string" && typeof rhs == "string") {
        return [lhs.toLowerCase(), rhs.toLowerCase()];
    } else {
        return [lhs, rhs];
    }
}

function evaluate(operator, lhs, rhs, options) {
    switch (operator) {
        case "===": {
            [lhs, rhs] = lowerIfPossible(lhs, rhs, options.case_insensitive);
            return lhs === rhs;
        }
        case "!==": {
            [lhs, rhs] = lowerIfPossible(lhs, rhs, options.case_insensitive);
            return lhs !== rhs;
        }
        case "==": {
            [lhs, rhs] = lowerIfPossible(lhs, rhs, options.case_insensitive);
            return (lhs === null ? "" : lhs) == (rhs === null ? "" : rhs);
        }
        case "!=": {
            [lhs, rhs] = lowerIfPossible(lhs, rhs, options.case_insensitive);
            return (lhs === null ? "" : lhs) != (rhs === null ? "" : rhs);
        }
        case ">": {
            [lhs, rhs] = lowerIfPossible(lhs, rhs, options.case_insensitive);
            return lhs > rhs;
        }
        case ">=": {
            [lhs, rhs] = lowerIfPossible(lhs, rhs, options.case_insensitive);
            return lhs >= rhs;
        }
        case "<": {
            [lhs, rhs] = lowerIfPossible(lhs, rhs, options.case_insensitive);
            return lhs < rhs;
        }
        case "<=": {
            [lhs, rhs] = lowerIfPossible(lhs, rhs, options.case_insensitive);
            return lhs <= rhs;
        }
        case "=~": {
            var xopts = "";
            if (options.regex_dot_all) {
                xopts += "s";
            }
            if (options.regex_multiline) {
                xopts += "m";
            }
            if (options.case_insensitive) {
                xopts += "i";
            }
            var regex = new RegExp(String(rhs), xopts);
            var str = String(lhs);
            var res = str.match(regex);
            return res !== null && (!options.regex_full_match || res[0].length == str.length);
        }
        case "in list": {
            lhs = String(lhs);
            lhs = options.case_insensitive ? lhs.toLowerCase() : lhs;
            rhs = options.case_insensitive ? rhs.toLowerCase() : rhs;
            return argToList(rhs).indexOf(lhs) >= 0;
        }
        case "not in list": {
            return !evaluate("in list", lhs, rhs, options);
        }
        default: {
            throw `Unknown operator: ${operator}`;
        }
    }
}

if ((args.condition && args.condition.indexOf("equals") >= 0 || (args.conditionB && args.conditionB.indexOf("equals") >= 0))) {
    throw "Legacy parameter (equals) is not supported for `condition`, please use lhs and rhs or leave it blank";
}
const condition = args.condition ? args.condition.trim() : 'value==equals';
const conditionB = args.conditionB ? args.conditionB.trim() : 'value==equals';
const conditionInBetween = args.conditionInBetween ? args.conditionInBetween.trim() : 'and';
const options = makeOptions(args.options);
const optionsB = makeOptions(args.optionsB);
const getValueArrayA = ["equals", "value", "lhs", "rhs"];
const [lhs_name, lhs] = getValue(args, condition, options, true, getValueArrayA);
const [rhs_name, rhs] = getValue(args, condition, options, false, getValueArrayA);
const operator = getOperator(lhs_name, rhs_name, condition);
const getValueArrayB = ["equals", "value","lhsB", "rhsB"];
const [lhsB_name, lhsB] = getValue(args, conditionB, optionsB, true, getValueArrayB);
const [rhsB_name, rhsB] = getValue(args, conditionB, optionsB, false, getValueArrayB);
const operator2 = getOperator(lhsB_name, rhsB_name, conditionB);

var resultA = evaluate(operator, lhs, rhs, options);

var ret;
if (lhsB) {
    var resultB = evaluate(operator2, lhsB, rhsB, optionsB);
    if (conditionInBetween == 'and' && (resultA && resultB))  {
        ret = convertValue(args, options["input_data_type:then"], args.then);
    }
    else if (conditionInBetween == 'or' && (resultA || resultB))  {
        ret = convertValue(args, options["input_data_type:then"], args.then);
    }
    else {
        ret = convertValue(args, options["input_data_type:else"], args.else);
    }
}
else {
    if (resultA) {
    ret = convertValue(args, options["input_data_type:then"], args.then);
    }
    else {
        ret = convertValue(args, options["input_data_type:else"], args.else);
    }
}
return ret === null ? "" : ret;
