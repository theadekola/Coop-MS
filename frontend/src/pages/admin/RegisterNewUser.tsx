import {useState} from 'react'
import toast from 'react-hot-toast'
import {useNavigate,useLocation} from 'react-router-dom'
import {staffApi} from '../../services/api'
import {useAuthStore} from '../../store/authStore'
import type {UserRole,Staff} from '../../types'
export default function RegisterNewUser(){
 const {user}=useAuthStore(),navigate=useNavigate(),location=useLocation()
 const state=location.state as {editUser?:Staff;staff?:Staff}|null,editUser=state?.editUser||state?.staff
 const [busy,setBusy]=useState(false),[form,setForm]=useState({fullName:editUser?.fullName||'',email:editUser?.email||'',phone:editUser?.phone||'',role:editUser?.role||'staff' as UserRole,password:''})
 const roles:UserRole[]=user?.role==='super_admin'?['staff','cashier','accountant','auditor','loan_officer','manager','admin','super_admin']:['staff','cashier','accountant','auditor','loan_officer','manager']
 return <main className="p-6 max-w-2xl"><h1 className="text-xl font-bold">{editUser?'Edit staff account':'Create staff account'}</h1><p className="my-4">Create an account through the authorised administration service. The user can enrol an authenticator after signing in. Account recovery requires administrator verification.</p><form className="space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);try{if(editUser){await staffApi.update(editUser.id,{fullName:form.fullName,email:form.email,phone:form.phone,role:form.role});toast.success('Staff account updated')}else{await staffApi.create(form);toast.success('Staff account created')}navigate('/admin/users')}catch{toast.error('Could not create staff account')}finally{setBusy(false)}}}>
 <label className="block">Full name<input className="input-field" value={form.fullName} maxLength={200} required onChange={e=>setForm({...form,fullName:e.target.value})}/></label>
 <label className="block">Email<input className="input-field" type="email" value={form.email} maxLength={200} required onChange={e=>setForm({...form,email:e.target.value})}/></label>
 <label className="block">Phone<input className="input-field" value={form.phone} maxLength={20} required onChange={e=>setForm({...form,phone:e.target.value})}/></label>
 <label className="block">Role<select className="input-field" value={form.role} onChange={e=>setForm({...form,role:e.target.value as UserRole})}>{roles.map(role=><option key={role} value={role}>{role.replace(/_/g,' ')}</option>)}</select></label>
 {!editUser && <label className="block">Initial password (at least 12 characters)<input className="input-field" type="password" autoComplete="new-password" value={form.password} minLength={12} required onChange={e=>setForm({...form,password:e.target.value})}/></label>}
 <button className="btn-primary" disabled={busy}>{editUser?'Save account':'Create account'}</button></form></main>
}
