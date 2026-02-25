import { snapValue, toSvgY, rotatePoint, getRotatedAABB } from './geometry.js';
import assert from 'assert';

console.log("Testing geometry.js...");

// Test snapValue
assert.strictEqual(snapValue(12, 10), 10);
assert.strictEqual(snapValue(18, 10), 20);
// Math.round(1.5) is 2 in JS
assert.strictEqual(snapValue(15, 10), 20);
console.log("snapValue passed");

// Test toSvgY
assert.strictEqual(toSvgY(100), -100);
console.log("toSvgY passed");

// Test rotatePoint
const p = rotatePoint(10, 0, 0, 0, 90);
// 90 deg: cos=0, sin=1.
// x = 0 + 10*0 - 0*1 = 0
// y = 0 + 10*1 + 0*0 = 10
// So (0, 10). Correct.
assert(Math.abs(p.x) < 0.0001, `Expected x=0, got ${p.x}`);
assert(Math.abs(p.y - 10) < 0.0001, `Expected y=10, got ${p.y}`);
console.log("rotatePoint passed");

// Test getRotatedAABB (Rect)
const rect = { x: 0, y: 0, w: 10, h: 10, rotation: 0 };
const aabb = getRotatedAABB(rect);
assert.deepStrictEqual(aabb, { minX: 0, minY: 0, maxX: 10, maxY: 10 });

// Test 45 deg rotation
const rect45 = { x: 0, y: 0, w: 10, h: 10, rotation: 45 };
const aabb45 = getRotatedAABB(rect45);
// Center is (5,5). Distance to corner is sqrt(5^2+5^2) = sqrt(50) ~= 7.071
// New bounds: 5 +/- 7.071
const expectedMin = 5 - Math.sqrt(50);
const expectedMax = 5 + Math.sqrt(50);

assert(Math.abs(aabb45.minX - expectedMin) < 0.0001);
assert(Math.abs(aabb45.maxX - expectedMax) < 0.0001);
console.log("getRotatedAABB passed");

console.log("All tests passed!");
