const expect = require('chai').expect;
const {cloneDeep} = require('../helpers');
const _ = require('lodash');

describe('Helpers', () => {
    describe('#cloneDeep()', () => {
        describe('Clone primitive var', () => {
            let a, b;
            before(() => {
                a = 5;
                b = cloneDeep(a);
            });
            it('Result of function is equal to the original var', () => {
                expect(a).to.be.equal(b);
            });
            it('Result of function is another var', () => {
                a++;
                expect(a).to.be.not.equal(b);
            });
        });
        describe('Clone object', () => {
            let a, b;
            before(() => {
                a = {
                    a: 1,
                    b: 2,
                    c: {
                        d: 3
                    }
                };
                b = cloneDeep(a);
            });
            it('Result of function is equal to the original object', () => {
                expect(_.isEqual(a, b)).to.be.true;
            });
            it('Result of function is another object', () => {
                a.a++;
                expect(_.isEqual(a, b)).to.be.false;
            });
        });
        describe('Clone array', () => {
            let a, b;
            before(() => {
                a = [1, 2, 3];
                b = cloneDeep(a);
            });
            it('Result of function is equal to the original array', () => {
                expect(_.isEqual(a, b)).to.be.true;
            });
            it('Result of function is another array', () => {
                a.push(4);
                expect(_.isEqual(a, b)).to.be.false;
            });
        });
        describe('Clone array with object', () => {
            let a, b;
            before(() => {
                a = [
                    {a: 1},
                    {a: 2}
                ];
                b = cloneDeep(a);
            });
            it('Result of function is equal to the original array', () => {
                expect(_.isEqual(a, b)).to.be.true;
            });
            it('Result of function is another array', () => {
                a[0].a = 2;
                expect(_.isEqual(a, b)).to.be.false;
            });
        });
    });
});
