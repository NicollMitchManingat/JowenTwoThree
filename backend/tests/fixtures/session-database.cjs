// Small in-memory PostgREST contract for authentication tests. Never opens a socket.
module.exports = function makeDatabase(tables) {
 return { tables, from(table) {
  const filters=[];let single=false,inserted
  const q={select(){return q},single(){single=true;return q},maybeSingle(){single=true;return q},order(){return q},
   eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},gt(k,v){filters.push(r=>r[k]>v);return q},is(k,v){filters.push(r=>(r[k]??null)===v);return q},
   insert(row){inserted=Array.isArray(row)?row:[row];return q},
   async then(resolve,reject){try{
    if(!tables[table]) throw Error('Unexpected table: '+table)
    if(inserted)tables[table].push(...inserted.map((r,i)=>({id:'new-'+i,...r})))
    const rows=tables[table].filter(r=>filters.every(f=>f(r)))
    return resolve({data:single?rows[0]||null:rows,error:null})
   }catch(e){return reject(e)}}}
  return q
 }}
}
