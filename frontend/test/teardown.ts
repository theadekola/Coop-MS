export default async function teardown(){await fetch('http://127.0.0.1:4173/__test_shutdown',{method:'POST',headers:{Connection:'close'}}).catch(()=>{})}
