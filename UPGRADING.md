# Upgrading Sequelize-nested-set

### Upgrading to >= 1.6

Default value of `levelColumnName` option will be changed from `level` to `false` in the next major release.
If you didn't use `levelColumnName` option, or it had falsable value, then you need to add this option: `levelColumnName: 'level'`.

```javascript
const Tag = ns(sequelize, DataTypes, 'Tag', {
    // your object attributes (table columns)
}, {
    levelColumnName: 'level',
    // other your options
});
```
