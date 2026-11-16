import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createAnalyticsClient, parseTsvGzip } from './apple-analytics-reports.mjs';

test('follows pagination and fetches multiple report kinds', async () => {
  const calls=[];
  const fetchImpl=async url => {
    calls.push(url);
    const cursor=new URL(url).searchParams.get('cursor');
    return {ok:true,status:200,json:async()=>cursor?{data:[{id:'b'}],links:{}}:{data:[{id:'a'}],links:{next:'https://api.appstoreconnect.apple.com/v1/analyticsReportRequests/request/reports?cursor=next'}}};
  };
  const client=createAnalyticsClient({token:'secret',fetchImpl});
  assert.deepEqual((await client.listReports('request')).map(x=>x.id),['a','b']);
  assert.equal(calls.length,2);
});

test('rejects external next-page origins and authentication leaks', async()=>{
  const client=createAnalyticsClient({token:'private-test-token',fetchImpl:async()=>({ok:true,status:200,json:async()=>({data:[],links:{next:'https://evil.example/steal'}})})});
  await assert.rejects(()=>client.listReports('req'),/URL|origen|origin/i);
});

test('downloads compressed segment, checks byte count and MD5 checksum, parses TSV', async()=>{
  const input=gzipSync('Date\tDownloads\n2026-11-16\t5\n');
  const hash=createHash('md5').update(input).digest('hex');
  const client=createAnalyticsClient({token:'secret',fetchImpl:async url=>({ok:true,status:200,arrayBuffer:async()=>input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength)})});
  const buf=await client.downloadSegment({attributes:{url:'https://example.s3.amazonaws.com/x',sizeInBytes:input.length,checksum:hash}});
  assert.deepEqual(parseTsvGzip(buf),[{Date:'2026-11-16',Downloads:'5'}]);
});

test('rejects corrupt checksum and non-HTTPS segment URLs', async()=>{
  const input=gzipSync('a\tb\n1\t2\n');
  const client=createAnalyticsClient({token:'secret',fetchImpl:async()=>({ok:true,status:200,arrayBuffer:async()=>input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength)})});
  await assert.rejects(()=>client.downloadSegment({attributes:{url:'https://example.s3.amazonaws.com/x',sizeInBytes:input.length,checksum:'bad'}}),/checksum/i);
  await assert.rejects(()=>client.downloadSegment({attributes:{url:'http://example.com/x',sizeInBytes:input.length,checksum:'bad'}}),/https/i);
});

test('HTTP errors include status but never secrets',async()=>{
  const client=createAnalyticsClient({token:'SECRET_UNIQUE_TOKEN',fetchImpl:async()=>({ok:false,status:403,json:async()=>({errors:[{detail:'SECRET_UNIQUE_TOKEN'}]})})});
  await assert.rejects(()=>client.listReports('req'),e=>e.message.includes('403')&&!e.message.includes('SECRET_UNIQUE_TOKEN'));
});
