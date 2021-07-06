# Sequelize Nested Set

[![NPM Version](https://img.shields.io/npm/v/sequelize-nested-set.svg?style=flat)](https://www.npmjs.com/package/sequelize-nested-set)
![Min Node Version](https://img.shields.io/node/v/sequelize-nested-set.svg?style=flat)
[![Build Status](https://travis-ci.com/fremail/sequelize-nested-set.svg?branch=master)](https://travis-ci.com/fremail/sequelize-nested-set)
[![Code Coverage](https://img.shields.io/codecov/c/github/fremail/sequelize-nested-set.svg?style=flat)](https://codecov.io/gh/fremail/sequelize-nested-set)
![Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/github/fremail/sequelize-nested-set/package.json.svg?style=flat)
![License](https://img.shields.io/github/license/fremail/sequelize-nested-set.svg)

Library to store and manage nested set trees using [Sequelize](https://github.com/sequelize/sequelize) version 4, 5 or 6! It supports multi-root trees.

Feel free to create an issue or PR if you have a bug or idea.

P.S. Don't forget to star this library. It stimulates me to support [the library](https://github.com/fremail/sequelize-nested-set)! ⭐️

P.P.S. If you feel like you could help me with the library (writing docs, adding new features, testing, fixing bugs or anything else) - you are welcome! If you need any info or have a question, just email me at fremail@yandex.com

## Quick links

* [Installation](#installation)
* [Getting started](#getting-started)
* [DB Table structure](#db-table-structure)
* [Nested Set Options](#nested-set-options)
* [Docs](https://github.com/fremail/sequelize-nested-set/wiki)
* [Docs: All functions](https://github.com/fremail/sequelize-nested-set/wiki/All-Methods)
* [Changelog](CHANGELOG.md)
* [License (MIT)](LICENSE)

## Installation

```bash
npm install --save sequelize-nested-set
```

Please note, you have to install [Sequelize](https://github.com/sequelize/sequelize) yourself.

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

## DB Table structure

Yes, it requires a basic structure of table where you want to keep your tree.

Here are the required fields:
* `lft` - int, not null. You can use another column name using `lftColumnName` option.
* `rgt` - int, not null. Use `rgtColumnName` option for custom column name.

If you want to store a multi-root tree (several trees in other words), you need to set `hasManyRoots` option to `true` and have one more column:
* `rootId` - column type must be the same with `id` column (default: int, but you can change it using `rootColumnType` option), not null. Default field name is `root_id`, but you can also use your own with `rootColumnName` option.

[Some methods](https://github.com/fremail/sequelize-nested-set/wiki/Heavy-load-methods) of this library require `level` or `parentId` field. If you don't have any of the fields, they will be generated on the fly which may result in high load and slow work. A simple way to optimize this issue is to add one of columns or both:
* `level` - int, not null. For its name you can also use `levelColumnName` option.
* `parentId` - primary key column type, nullable. You can use another column name using `parentIdColumnName` option. Don't forget to set correct `parentIdColumnType` if your Primary Key is not an integer.

## Nested Set Options

There are the options to customize your nested set. All these options are optional.
* `hasManyRoots` (boolean, default: `false`) - for cases when you want to store several trees in one table.
* `lftColumnName` (string, default: `lft`) - a column name for lft.
* `rgtColumnName` (string, default: `rgt`) - a column name for rgt.
* `levelColumnName` (string, default: `false`) - a column name for level (optional column).
* `rootColumnName` (string, default: `root_id`) - a column name for rootId. Value of this option makes sense only if `hasManyRoots` is `true`.
* `rootColumnType` (one of DataTypes.*, default: `DataTypes.INTEGER`) - a column type for rootId. It must be the same column type as the id column. Value of this option makes sense only if `hasManyRoots` is `true`.
* `parentIdColumnName` (string, default: `false`) - a column type for parentId (optional column).
* `parentIdColumnType` (one of DataTypes.*, default: `DataTypes.VIRTUAL`) - a column type for parentId. It must be the same column type as the id column.

## API docs

I'm trying to keep all functions good-documented, but if you want more info about the functions with examples etc., please visit API docs in [wiki](https://github.com/fremail/sequelize-nested-set/wiki/All-Methods).

## Upgrading

See [CHANGELOG.md](CHANGELOG.md) for list of changes and [UPGRADING.md](UPGRADING.md) for guide how to upgrade your code.
