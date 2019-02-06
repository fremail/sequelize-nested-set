# Sequelize Nested Set

[![NPM Version](https://img.shields.io/npm/v/sequelize-nested-set.svg?style=flat)](https://www.npmjs.com/package/sequelize-nested-set)
![Min Node Version](https://img.shields.io/node/v/sequelize-nested-set.svg?style=flat)
[![Build Status](https://travis-ci.com/fremail/sequelize-nested-set.svg?branch=master)](https://travis-ci.com/fremail/sequelize-nested-set)
![Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/github/fremail/sequelize-nested-set/package.json.svg?style=flat)
![License](https://img.shields.io/github/license/fremail/sequelize-nested-set.svg)

Library to store and manage nested set trees using [Sequelize](https://github.com/sequelize/sequelize). It supports multi-root trees.

Feel free to create an issue or PR if you have a bug or idea.

## Installation

**Warning! This library is on beta testing! Be careful with using it.** 

```bash
npm i sequelize-nested-set
```

## Getting started

This library works as a wrapper for `sequelize.define`, it has the same params: model name, attributes (aka table fields), options, but the first 2 params are sequelize connection and DataTypes object.

```javascript
const ns = require('sequelize-nested-set');

module.exports = (sequelize, DataTypes) => {
    const Tag = ns(sequelize, DataTypes, 'Tag', {
        label: DataTypes.STRING,
    }, {
        tableName: 'tag',
        timestamps: false,
        hasManyRoots: true,
    });
    
    // add additional methods, associations to the model
    
    return Tag;
};
```

## Table structure

Yes, it requires a basic structure of table where you want to keep your tree.

Here are the required fields:
* `lft` - int, not null. You can use another column name using `lftColumnName` option.
* `rgt` - int, not null. Use `rgtColumnName` option for custom column name.
* `level` - int, not null. For its name you can also use `levelColumnName` option.

If you want to store a multi-root tree (several trees in other words), you need to set `hasManyRoots` option to `true` and have one more column:
* `rootId` - column type must be the same with `id` column (default: int, but you can change it using `rootColumnType` option), not null. Default field name is `root_id`, but you can also use your own with `rootColumnName` option.

## Nested Set Options

There are several options to customize your nested set:
* `hasManyRoots` (boolean, default: `false`) - for cases when you want to store several trees in one table.
* `lftColumnName` (string, default: `lft`) - a column name for lft.
* `rgtColumnName` (string, default: `rgt`) - a column name for rgt.
* `levelColumnName` (string, default: `level`) - a column name for level.
* `rootColumnName` (string, default: `root_id`) - a column name for rootId. Value of this option makes sense only if `hasManyRoots` is `true`.
* `rootColumnType` (one of DataTypes.*, default: `DataTypes.INTEGER`) - a column type for rootId. It must be the same column type as the id column. Value of this option makes sense only if `hasManyRoots` is `true`.

