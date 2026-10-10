import test from 'node:test';
import assert from 'node:assert/strict';
import {locateHighlight,type Highlight} from '../web/highlight-anchors.js';
import {highlightsSchema} from '../server/highlights.js';
const highlight:Highlight={id:'45374267-4321-4123-8123-123456789012',contentKey:'main',exact:'两边同时减去 3',prefix:'因为',suffix:'，等式保持成立。',start:2};
test('高亮锚点在段落增量修改后定位，不猜测同文句子的归属',()=>{
 assert.equal(locateHighlight('因为两边同时减去 3，等式保持成立。',highlight),2);
 assert.equal(locateHighlight('补充说明：因为两边同时减去 3，等式保持成立。',highlight),7);
 assert.equal(locateHighlight('两边同时减去 3。这是另一段。两边同时减去 3。',{...highlight,prefix:'',suffix:'',start:99}),null);
 assert.equal(locateHighlight('两边同时减去 3。这是另一段。两边同时减去 3。',{...highlight,prefix:'',suffix:'',start:0}),0);
 assert.equal(locateHighlight('正文已经删除了标注语句。',highlight),null);
 assert.equal(highlightsSchema.parse([highlight])[0].exact,highlight.exact);
 assert.throws(()=>highlightsSchema.parse([highlight,highlight]),/不得重复/);
 assert.throws(()=>highlightsSchema.parse([{...highlight,start:-1}]));
});
