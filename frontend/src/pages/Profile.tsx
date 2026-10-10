import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
export default function Profile(){
  const {user,updateUser}=useAuthStore()
  const [form,setForm]=useState({fullName:user?.fullName||'',email:user?.email||'',phone:user?.phone||''})
  const [busy,setBusy]=useState(false)
  useEffect(()=>{authApi.me().then(next=>{updateUser(next);setForm({fullName:next.fullName,email:next.email,phone:next.phone||''})}).catch(()=>toast.error('Could not load profile'))},[])
  return <main className="p-6 max-w-2xl"><h1 className="text-xl font-bold">My profile</h1><form className="space-y-4 my-6" onSubmit={async e=>{e.preventDefault();setBusy(true);try{updateUser(await authApi.updateMe(form));toast.success('Profile saved')}catch{toast.error('Could not save profile')}finally{setBusy(false)}}}>
    <label className="block">Full name<input className="input-field" value={form.fullName} maxLength={200} required onChange={e=>setForm({...form,fullName:e.target.value})}/></label>
    <label className="block">Email<input className="input-field" type="email" value={form.email} maxLength={200} required onChange={e=>setForm({...form,email:e.target.value})}/></label>
    <label className="block">Phone<input className="input-field" value={form.phone} maxLength={20} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
    <p>Employee ID: {user?.employeeId} · Role: {user?.role} · Department: {user?.department}</p><p className="text-sm">An authorised administrator manages employment details.</p>
    <button className="btn-primary" disabled={busy}>Save profile</button></form><Link to="/settings/security" className="btn-secondary">Manage sessions and two-factor authentication</Link></main>
}
