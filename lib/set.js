const { propertyRegex } = require("./parser/grammar");
const split = require("./split");
const get = require("./get");


const cp = v => JSON.parse(JSON.stringify(v));
const toString = Object.prototype.toString;
const getType = v => toString.call(v).match(/\s([^\]]+)\]/).pop().toLowerCase();
const isProperty = new RegExp(`^("[^"]+"|${propertyRegex})$`);
const ignoreTypes = ["string", "number", "boolean", "null"];
const isArray = /^\[\d*\]$/;
const arrayHasIndex = /^\[(\d+)\]$/;
const queryIsArray = /.+\[\]$/;


function create(workingSet, query, keyIsArray) {
    return workingSet
        .filter(o => ignoreTypes.includes(getType(o[0][query])) === false)
        .map(r => {
            const container = keyIsArray ? [] : {};
            const o = r[0];

            if (isArray.test(query)) {
                if (arrayHasIndex.test(query)) {
                    const index = parseInt(query.match(arrayHasIndex).pop());
                    if (o.length < index) {
                        o[index] = container;
                    } else {
                        o.splice(index, 0, container);
                    }
                    // console.log([o[index], index, o, `${r[2]}/${index}}`]);
                    return [o[index], index, o, `${r[3]}/${index}}`];
                } else {
                    o.push(container);
                    // console.log([o[o.length - 1], o.length - 1, o, `${r[2]}/${o.length - 1}}`]);
                    return [o[o.length - 1], o.length - 1, o, `${r[3]}/${o.length - 1}}`];
                }
            }

            o[query] = o[query] || container;
            return [o[query], query, o, `${r[3]}/${query}`];
        });
}


function select(workingSet, query) {
    const nextSet = [];
    workingSet.forEach(d => {
        nextSet.push(...get(d[0], query, get.ALL));
    });
    return nextSet;
}


function set(data, queryString, value) {
    if (queryString == null) {
        return cp(data);
    }

    queryString = queryString.replace(/(\/$)/g, "");
    if (queryString === "") {
        return cp(value);
    }

    const result = cp(data);
    let workingSet = [[result, null, null, "#"]];
    const path = split(queryString);
    const property = path.pop();

    const arrayWithoutIndex = isArray.test(property) && arrayHasIndex.test(property) === false;
    if (isProperty.test(property) === false || arrayWithoutIndex) {
        throw new Error(`Unsupported query '${queryString}' ending with non-property`);
    }

    path.forEach((query, index) => {
        if (isProperty.test(query)) {
            const keyIsArray = queryIsArray.test(query) || isArray.test(path[index + 1]);
            if (keyIsArray) {
                workingSet = create(workingSet, query.replace(/\[\]$/, ""), true);
            } else {
                workingSet = create(workingSet, query);
            }
        } else {
            workingSet = select(workingSet, query);
        }
    });

    workingSet.forEach(r => {
        let targetValue = value;

        if (typeof value === "function") {
            targetValue = value(r[3], property, r[0], `${r[3]}/${property}`);
        }

        const d = r[0];
        if (Array.isArray(d)) {
            if (d.length < parseInt(property)) {
                d[property] = targetValue;
            } else {
                d.splice(property, 0, targetValue);
            }
            // const p = {};
            // p[property] = targetValue;
            // d.push(p);
        } else {
            d[property] = targetValue;
        }
    });

    return result;
}


module.exports = set;