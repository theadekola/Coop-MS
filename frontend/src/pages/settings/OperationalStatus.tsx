import {useEffect,useState} from 'react'
import api from '../../services/api'
export default function OperationalStatus({field,title}:{field:string;title:string}){
 const [data,setData]=useState<unknown>(),[error,setError]=useState('')
 useEffect(()=>{api.get('/security/policy').then(r=>setData(r.data.data[field])).catch(()=>setError('Could not load operational status'))},[field])
 return <main className="p-6 max-w-3xl"><h1 className="text-xl font-bold mb-4">{title}</h1>{error?<p role="alert">{error}</p>:typeof data==='object'?<ul className="space-y-3">{Object.entries(data||{}).map(([role,value])=><li key={role}><strong>{role}:</strong> {String(value)}</li>)}</ul>:<p>{String(data||'Loading...')}</p>}</main>
}
