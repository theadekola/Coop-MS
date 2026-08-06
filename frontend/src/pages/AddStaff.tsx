import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Flag,
  Home,
  ImagePlus,
  Mail,
  MapPin,
  Phone,
  Printer,
  Save,
  Shield,
  Trash2,
  UploadCloud,
  User,
  UserPlus,
} from 'lucide-react'
import { staffApi } from '../services/api'
import type { Staff } from '../types'

type Step = 1 | 2 | 3 | 4 | 5

type StaffForm = {
  staffId: string
  title: string
  fullName: string
  dateOfBirth: string
  gender: string
  maritalStatus: string
  nationality: string
  stateOfOrigin: string
  lga: string
  department: string
  position: string
  employmentType: string
  dateOfEmployment: string
  employeeNumber: string
  reportingTo: string
  workLocation: string
  workSchedule: string
  probationPeriod: string
  confirmationDate: string
  contractEndDate: string
  salaryGrade: string
  basicSalary: string
  employmentStatus: string
  jobDescription: string
  primaryPhone: string
  alternatePhone: string
  email: string
  workEmail: string
  address1: string
  address2: string
  country: string
  state: string
  city: string
  postalCode: string
  landmark: string
  nextOfKinName: string
  nextOfKinRelationship: string
  nextOfKinPhone: string
  nextOfKinAltPhone: string
  nextOfKinEmail: string
  nextOfKinAddress: string
  nextOfKinOccupation: string
  smsNotifications: boolean
  emailNotifications: boolean
  postalCorrespondence: boolean
  nin: string
  bvn: string
  driversLicense: string
  passportNumber: string
  bankName: string
  accountNumber: string
  accountName: string
  bloodGroup: string
  genotype: string
  disabilityStatus: string
  highestQualification: string
  fieldOfStudy: string
  institution: string
  graduationYear: string
}

const blankForm: StaffForm = {
  staffId: '',
  title: '',
  fullName: '',
  dateOfBirth: '',
  gender: '',
  maritalStatus: '',
  nationality: 'Nigeria',
  stateOfOrigin: '',
  lga: '',
  department: '',
  position: '',
  employmentType: '',
  dateOfEmployment: '',
  employeeNumber: '',
  reportingTo: '',
  workLocation: '',
  workSchedule: '',
  probationPeriod: '',
  confirmationDate: '',
  contractEndDate: '',
  salaryGrade: '',
  basicSalary: '',
  employmentStatus: 'active',
  jobDescription: '',
  primaryPhone: '',
  alternatePhone: '',
  email: '',
  workEmail: '',
  address1: '',
  address2: '',
  country: 'Nigeria',
  state: '',
  city: '',
  postalCode: '',
  landmark: '',
  nextOfKinName: '',
  nextOfKinRelationship: '',
  nextOfKinPhone: '',
  nextOfKinAltPhone: '',
  nextOfKinEmail: '',
  nextOfKinAddress: '',
  nextOfKinOccupation: '',
  smsNotifications: true,
  emailNotifications: true,
  postalCorrespondence: true,
  nin: '',
  bvn: '',
  driversLicense: '',
  passportNumber: '',
  bankName: '',
  accountNumber: '',
  accountName: '',
  bloodGroup: '',
  genotype: '',
  disabilityStatus: '',
  highestQualification: '',
  fieldOfStudy: '',
  institution: '',
  graduationYear: '',
}

const steps: Array<{ id: Step; title: string; sub: string }> = [
  { id: 1, title: 'Personal Information', sub: 'Basic details about staff' },
  { id: 2, title: 'Employment Details', sub: 'Job and department info' },
  { id: 3, title: 'Contact & Address', sub: 'Contact and address info' },
  { id: 4, title: 'Additional Information', sub: 'Other relevant details' },
  { id: 5, title: 'Review & Save', sub: 'Review and save staff' },
]

const departments = ['Accounts', 'Audit', 'Management', 'Trading', 'HR', 'Operations', 'IT', 'General']
const states = ['Lagos State', 'Ogun State', 'Oyo State', 'Osun State', 'Ondo State', 'Ekiti State', 'Abuja FCT']

function fromStaff(staff?: Staff): StaffForm {
  if (!staff) return blankForm
  return {
    ...blankForm,
    staffId: staff.employeeId || '',
    fullName: staff.fullName,
    primaryPhone: staff.phone,
    email: staff.email,
    department: staff.department || '',
    position: staff.role.replace(/_/g, ' '),
    employmentStatus: staff.status,
    dateOfEmployment: staff.joinedDate || '',
  }
}

export default function AddStaff() {
  const navigate = useNavigate()
  const location = useLocation()
  const editingStaff = (location.state as { staff?: Staff } | null)?.staff
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<StaffForm>(() => {
    const draft = localStorage.getItem('staff-registration-draft')
    if (!editingStaff && draft) {
      try { return { ...blankForm, ...JSON.parse(draft) } } catch { localStorage.removeItem('staff-registration-draft') }
    }
    return fromStaff(editingStaff)
  })
  const [photoName, setPhotoName] = useState('')
  const [documents, setDocuments] = useState<Array<{ name: string; type: string; size: number }>>([])
  const [confirmed, setConfirmed] = useState(false)
  const progress = step * 20

  const requiredMissing = useMemo(() => {
    const required = ['title', 'fullName', 'dateOfBirth', 'gender', 'nationality', 'stateOfOrigin', 'department', 'position', 'employmentType', 'dateOfEmployment', 'primaryPhone', 'email', 'address1', 'country', 'state', 'city', 'nextOfKinName', 'nextOfKinRelationship', 'nextOfKinPhone', 'nextOfKinAddress']
    return required.filter(key => !String(form[key as keyof StaffForm] ?? '').trim())
  }, [form])

  const setField = <K extends keyof StaffForm>(key: K, value: StaffForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const saveDraft = () => {
    localStorage.setItem('staff-registration-draft', JSON.stringify(form))
    toast.success('Staff draft saved')
  }

  const next = () => setStep(current => Math.min(5, current + 1) as Step)
  const previous = () => setStep(current => Math.max(1, current - 1) as Step)

  const handleSubmit = async (createUserAccount: boolean) => {
    if (requiredMissing.length) {
      toast.error('Please complete all required fields before saving')
      return
    }
    if (!confirmed && step === 5) {
      toast.error('Please confirm the information is accurate')
      return
    }
    try {
      const payload = {
        fullName: `${form.title ? `${form.title} ` : ''}${form.fullName}`.trim(),
        email: form.email,
        phone: form.primaryPhone,
        role: createUserAccount ? 'staff' as const : 'staff' as const,
        department: form.department || 'General',
        password: createUserAccount ? 'Staff@12345' : undefined,
      }
      if (editingStaff) {
        const normalizedStatus: Staff['status'] = form.employmentStatus === 'on_leave' ? 'on_leave' : form.employmentStatus === 'resigned' ? 'inactive' : 'active'
        await staffApi.update(editingStaff.id, {
          fullName: payload.fullName,
          email: payload.email,
          phone: payload.phone,
          department: payload.department,
          status: normalizedStatus,
        })
        toast.success('Staff record updated')
      } else {
        await staffApi.create(payload)
        toast.success(createUserAccount ? 'Staff and user account created' : 'Staff record created')
      }
      localStorage.removeItem('staff-registration-draft')
      navigate('/staff')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save staff record')
    }
  }

  const onPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoName(file.name)
    toast.success('Passport photograph selected')
  }

  const onDocuments = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setDocuments(prev => [...prev, ...files.map(file => ({ name: file.name, type: file.type || 'Document', size: file.size }))])
    if (files.length) toast.success(`${files.length} document${files.length === 1 ? '' : 's'} attached`)
    event.target.value = ''
  }

  return (
    <div className="p-4 lg:p-5 space-y-4">
      <div>
        <h2 className="page-header">{editingStaff ? 'Edit Staff' : 'Add New Staff'}</h2>
        <nav className="text-xs text-slate-500 mt-1">Dashboard <span className="mx-1">›</span> Staff Management <span className="mx-1">›</span> Add New Staff</nav>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {steps.map(item => (
            <button key={item.id} onClick={() => setStep(item.id)} className={`flex items-center gap-3 text-left border-b-2 pb-3 ${step === item.id ? 'border-indigo-600' : item.id < step ? 'border-green-500' : 'border-slate-100'}`}>
              <span className={`h-8 w-8 rounded-full grid place-items-center text-sm font-bold ${item.id < step ? 'bg-green-100 text-green-700' : step === item.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-navy'}`}>
                {item.id < step ? <Check size={15} /> : item.id}
              </span>
              <span>
                <span className="block text-sm font-bold text-navy">{item.title}</span>
                <span className="block text-xs text-slate-500">{item.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
        <form className="card p-4 space-y-4" onSubmit={(event: FormEvent) => event.preventDefault()}>
          {step === 1 && (
            <>
              <Section title="Personal Information" sub="Enter the basic personal details of the staff member.">
                <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] gap-4">
                  <label className="h-48 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/40 grid place-items-center text-center cursor-pointer">
                    <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
                    <span>
                      <ImagePlus className="mx-auto text-indigo-600" size={34} />
                      <span className="block mt-2 text-sm font-semibold text-navy">{photoName || 'Click to upload photo'}</span>
                      <span className="block text-xs text-slate-500">JPG, PNG or GIF. Max size 2MB</span>
                    </span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Staff ID" value={form.staffId || 'Auto generated'} disabled onChange={() => null} required />
                    <SelectField label="Title" value={form.title} required options={['Mr.', 'Mrs.', 'Miss', 'Ms.', 'Dr.', 'Prof.']} onChange={value => setField('title', value)} />
                    <Field label="Full Name" value={form.fullName} required icon={<User size={14} />} onChange={value => setField('fullName', value)} />
                    <Field label="Date of Birth" type="date" value={form.dateOfBirth} required icon={<Calendar size={14} />} onChange={value => setField('dateOfBirth', value)} />
                    <SelectField label="Gender" value={form.gender} required options={['Male', 'Female']} onChange={value => setField('gender', value)} />
                    <SelectField label="Marital Status" value={form.maritalStatus} options={['Single', 'Married', 'Divorced', 'Widowed']} onChange={value => setField('maritalStatus', value)} />
                    <SelectField label="Nationality" value={form.nationality} required options={['Nigeria', 'Ghana', 'Benin', 'Togo', 'Other']} onChange={value => setField('nationality', value)} />
                    <SelectField label="State of Origin" value={form.stateOfOrigin} required options={states} onChange={value => setField('stateOfOrigin', value)} />
                    <Field label="Local Government Area" value={form.lga} required icon={<Flag size={14} />} onChange={value => setField('lga', value)} />
                  </div>
                </div>
              </Section>
              <Section title="Quick Employment Info" sub="Add quick employment details. More information can be added in the next step.">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <SelectField label="Department" value={form.department} required options={departments} onChange={value => setField('department', value)} />
                  <Field label="Position / Job Title" value={form.position} required icon={<Briefcase size={14} />} onChange={value => setField('position', value)} />
                  <SelectField label="Employment Type" value={form.employmentType} required options={['Full-time', 'Part-time', 'Contract', 'Temporary', 'Intern']} onChange={value => setField('employmentType', value)} />
                  <Field label="Date of Employment" type="date" value={form.dateOfEmployment} required icon={<Calendar size={14} />} onChange={value => setField('dateOfEmployment', value)} />
                </div>
              </Section>
            </>
          )}

          {step === 2 && (
            <Section title="Employment Details" sub="Enter job and department related information.">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <SelectField label="Department" value={form.department} required options={departments} onChange={value => setField('department', value)} />
                <Field label="Position / Job Title" value={form.position} required icon={<Briefcase size={14} />} onChange={value => setField('position', value)} />
                <SelectField label="Employment Type" value={form.employmentType} required options={['Full-time', 'Part-time', 'Contract', 'Temporary', 'Intern']} onChange={value => setField('employmentType', value)} />
                <Field label="Date of Employment" type="date" value={form.dateOfEmployment} required icon={<Calendar size={14} />} onChange={value => setField('dateOfEmployment', value)} />
                <Field label="Staff ID" value={form.staffId || 'Auto generated'} disabled onChange={() => null} />
                <Field label="Employee Number" value={form.employeeNumber} icon={<User size={14} />} onChange={value => setField('employeeNumber', value)} />
                <SelectField label="Reporting To" value={form.reportingTo} options={['Head of Accounts', 'Admin Manager', 'General Manager', 'Managing Director']} onChange={value => setField('reportingTo', value)} />
                <SelectField label="Work Location / Branch" value={form.workLocation} required options={['Head Office', 'Oshodi Branch', 'Isolo Branch', 'Remote']} onChange={value => setField('workLocation', value)} />
                <SelectField label="Work Schedule" value={form.workSchedule} options={['Mon - Fri, 8:00 AM - 5:00 PM', 'Shift', 'Flexible']} onChange={value => setField('workSchedule', value)} />
                <SelectField label="Probation Period" value={form.probationPeriod} options={['None', '1 Month', '3 Months', '6 Months']} onChange={value => setField('probationPeriod', value)} />
                <Field label="Confirmation Date" type="date" value={form.confirmationDate} icon={<Calendar size={14} />} onChange={value => setField('confirmationDate', value)} />
                <Field label="Contract End Date" type="date" value={form.contractEndDate} icon={<Calendar size={14} />} onChange={value => setField('contractEndDate', value)} />
                <SelectField label="Salary Grade / Scale" value={form.salaryGrade} options={['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Management']} onChange={value => setField('salaryGrade', value)} />
                <Field label="Basic Salary (N)" value={form.basicSalary} icon={<Banknote size={14} />} onChange={value => setField('basicSalary', value)} />
                <SelectField label="Employment Status" value={form.employmentStatus} required options={['active', 'on_leave', 'resigned']} onChange={value => setField('employmentStatus', value)} />
              </div>
              <Textarea label="Job Description / Responsibilities" value={form.jobDescription} max={500} onChange={value => setField('jobDescription', value)} />
            </Section>
          )}

          {step === 3 && (
            <>
              <Section title="Contact & Address" sub="Enter contact details, residential address and emergency contact information.">
                <FormGroup title="1. Contact Information">
                  <Field label="Primary Phone Number" value={form.primaryPhone} required icon={<Phone size={14} />} onChange={value => setField('primaryPhone', value)} />
                  <Field label="Alternative Phone Number" value={form.alternatePhone} icon={<Phone size={14} />} onChange={value => setField('alternatePhone', value)} />
                  <Field label="Email Address" type="email" value={form.email} required icon={<Mail size={14} />} onChange={value => setField('email', value)} />
                  <Field label="Work Email" type="email" value={form.workEmail} icon={<Mail size={14} />} onChange={value => setField('workEmail', value)} />
                </FormGroup>
                <FormGroup title="2. Residential Address">
                  <Field label="Residential Address Line 1" value={form.address1} required icon={<Home size={14} />} onChange={value => setField('address1', value)} />
                  <Field label="Address Line 2" value={form.address2} icon={<Home size={14} />} onChange={value => setField('address2', value)} />
                  <SelectField label="Country" value={form.country} required options={['Nigeria', 'Ghana', 'Benin', 'Other']} onChange={value => setField('country', value)} />
                  <SelectField label="State" value={form.state} required options={states} onChange={value => setField('state', value)} />
                  <Field label="Local Government Area" value={form.lga} required icon={<MapPin size={14} />} onChange={value => setField('lga', value)} />
                  <Field label="City / Town" value={form.city} required icon={<MapPin size={14} />} onChange={value => setField('city', value)} />
                  <Field label="Postal Code" value={form.postalCode} onChange={value => setField('postalCode', value)} />
                  <Field label="Landmark" value={form.landmark} icon={<MapPin size={14} />} onChange={value => setField('landmark', value)} />
                </FormGroup>
                <FormGroup title="3. Emergency Contact / Next of Kin">
                  <Field label="Full Name" value={form.nextOfKinName} required icon={<User size={14} />} onChange={value => setField('nextOfKinName', value)} />
                  <SelectField label="Relationship" value={form.nextOfKinRelationship} required options={['Spouse', 'Sibling', 'Parent', 'Child', 'Friend', 'Other']} onChange={value => setField('nextOfKinRelationship', value)} />
                  <Field label="Phone Number" value={form.nextOfKinPhone} required icon={<Phone size={14} />} onChange={value => setField('nextOfKinPhone', value)} />
                  <Field label="Alternative Phone" value={form.nextOfKinAltPhone} icon={<Phone size={14} />} onChange={value => setField('nextOfKinAltPhone', value)} />
                  <Field label="Email" type="email" value={form.nextOfKinEmail} icon={<Mail size={14} />} onChange={value => setField('nextOfKinEmail', value)} />
                  <Field label="Residential Address" value={form.nextOfKinAddress} required icon={<Home size={14} />} onChange={value => setField('nextOfKinAddress', value)} />
                  <Field label="Occupation" value={form.nextOfKinOccupation} icon={<Briefcase size={14} />} onChange={value => setField('nextOfKinOccupation', value)} />
                </FormGroup>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Toggle label="SMS Notifications" checked={form.smsNotifications} onChange={value => setField('smsNotifications', value)} />
                  <Toggle label="Email Notifications" checked={form.emailNotifications} onChange={value => setField('emailNotifications', value)} />
                  <Toggle label="Postal Correspondence" checked={form.postalCorrespondence} onChange={value => setField('postalCorrespondence', value)} />
                </div>
              </Section>
            </>
          )}

          {step === 4 && (
            <>
              <Section title="Additional Information" sub="Provide other relevant details about the staff member.">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <FormGroup title="Identification">
                    <Field label="National ID Number" value={form.nin} icon={<FileText size={14} />} onChange={value => setField('nin', value)} />
                    <Field label="BVN" value={form.bvn} icon={<Shield size={14} />} onChange={value => setField('bvn', value)} />
                    <Field label="Driver's License Number" value={form.driversLicense} onChange={value => setField('driversLicense', value)} />
                    <Field label="Passport Number" value={form.passportNumber} onChange={value => setField('passportNumber', value)} />
                  </FormGroup>
                  <FormGroup title="Education">
                    <SelectField label="Highest Qualification" value={form.highestQualification} options={['SSCE', 'OND', 'HND', 'B.Sc', 'M.Sc', 'Ph.D', 'Professional']} onChange={value => setField('highestQualification', value)} />
                    <Field label="Field of Study" value={form.fieldOfStudy} onChange={value => setField('fieldOfStudy', value)} />
                    <Field label="Institution" value={form.institution} onChange={value => setField('institution', value)} />
                    <Field label="Graduation Year" value={form.graduationYear} onChange={value => setField('graduationYear', value)} />
                  </FormGroup>
                  <FormGroup title="Bank Information">
                    <SelectField label="Bank Name" value={form.bankName} options={['Access Bank', 'First Bank', 'GTBank', 'UBA', 'Zenith Bank', 'Wema Bank', 'Other']} onChange={value => setField('bankName', value)} />
                    <Field label="Account Number" value={form.accountNumber} onChange={value => setField('accountNumber', value)} />
                    <Field label="Account Name" value={form.accountName} icon={<User size={14} />} onChange={value => setField('accountName', value)} />
                  </FormGroup>
                  <FormGroup title="Other Information">
                    <SelectField label="Blood Group" value={form.bloodGroup} options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} onChange={value => setField('bloodGroup', value)} />
                    <Field label="Genotype" value={form.genotype} onChange={value => setField('genotype', value)} />
                    <SelectField label="Disability Status" value={form.disabilityStatus} options={['None', 'Physical', 'Visual', 'Hearing', 'Other']} onChange={value => setField('disabilityStatus', value)} />
                  </FormGroup>
                </div>
              </Section>
              <Section title="Documents" sub="Upload supporting documents. You can upload multiple files.">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
                  <label className="rounded-lg border border-dashed border-indigo-200 p-8 text-center cursor-pointer">
                    <input type="file" multiple onChange={onDocuments} className="hidden" />
                    <UploadCloud className="mx-auto text-indigo-600" size={34} />
                    <span className="block mt-2 text-sm font-semibold text-navy">Drag and drop files here or click to browse</span>
                    <span className="text-xs text-slate-500">PDF, JPG, PNG or DOC. Max 5MB each</span>
                  </label>
                  <div className="space-y-2">
                    {documents.length === 0 && <div className="text-sm text-slate-400">No documents uploaded yet.</div>}
                    {documents.map((doc, index) => (
                      <div key={`${doc.name}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                        <span><span className="block text-sm font-semibold text-navy">{doc.name}</span><span className="text-xs text-slate-500">{Math.ceil(doc.size / 1024)} KB</span></span>
                        <button type="button" onClick={() => setDocuments(prev => prev.filter((_, docIndex) => docIndex !== index))} className="text-red-500"><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            </>
          )}

          {step === 5 && (
            <Section title="Review & Confirm Details" sub="Please review all information carefully before saving. You can go back to edit any section.">
              <ReviewSection title="Personal Information" onEdit={() => setStep(1)} rows={[
                ['Full Name', `${form.title} ${form.fullName}`.trim()],
                ['Date of Birth', form.dateOfBirth],
                ['Gender', form.gender],
                ['Nationality', form.nationality],
                ['State of Origin', form.stateOfOrigin],
                ['Local Government Area', form.lga],
                ['National ID Number', form.nin],
                ['BVN', form.bvn],
              ]} />
              <ReviewSection title="Employment Details" onEdit={() => setStep(2)} rows={[
                ['Department', form.department],
                ['Position / Job Title', form.position],
                ['Employment Type', form.employmentType],
                ['Date of Employment', form.dateOfEmployment],
                ['Employment Status', form.employmentStatus],
                ['Reporting To', form.reportingTo],
                ['Work Location / Branch', form.workLocation],
                ['Monthly Salary', form.basicSalary ? `N${form.basicSalary}` : '-'],
              ]} />
              <ReviewSection title="Contact & Address" onEdit={() => setStep(3)} rows={[
                ['Phone Number', form.primaryPhone],
                ['Email Address', form.email],
                ['Emergency Contact', `${form.nextOfKinPhone} (${form.nextOfKinName})`],
                ['Address', form.address1],
                ['State', form.state],
                ['City', form.city],
                ['Country', form.country],
              ]} />
              <ReviewSection title="Additional Information" onEdit={() => setStep(4)} rows={[
                ['Highest Qualification', form.highestQualification],
                ['Field of Study', form.fieldOfStudy],
                ['Institution', form.institution],
                ['Bank Name', form.bankName],
                ['Account Number', form.accountNumber],
                ['Blood Group', form.bloodGroup],
                ['Genotype', form.genotype],
              ]} />
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-navy">Uploaded Documents ({documents.length})</h4>
                  <button type="button" onClick={() => setStep(4)} className="text-xs font-semibold text-indigo-600">View All</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {documents.length ? documents.map(doc => <span key={doc.name} className="rounded-lg bg-slate-50 p-2 text-xs font-semibold text-navy">{doc.name}</span>) : <span className="text-sm text-slate-400">No uploaded documents.</span>}
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm text-navy">
                <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />
                I confirm that the information provided above is accurate and complete to the best of my knowledge.
              </label>
            </Section>
          )}

          <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={step === 1 ? () => navigate('/staff') : previous} className="btn-secondary"><ArrowLeft size={14} /> {step === 1 ? 'Cancel' : 'Previous'}</button>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={saveDraft} className="btn-secondary"><Save size={14} /> Save as Draft</button>
              {step === 5 && <button type="button" onClick={() => window.print()} className="btn-secondary"><Printer size={14} /> Print Preview</button>}
              {step < 5 ? (
                <button type="button" onClick={next} className="btn-primary">Next: {steps[step]?.title} <ArrowRight size={14} /></button>
              ) : (
                <>
                  <button type="button" onClick={() => handleSubmit(false)} className="btn-primary"><Save size={14} /> Create Staff Record</button>
                  <button type="button" onClick={() => handleSubmit(true)} className="btn-success"><UserPlus size={14} /> Create Staff & User Account</button>
                </>
              )}
            </div>
          </div>
        </form>

        <aside className="space-y-4">
          <SideCard title={step === 5 ? 'Staff Profile Preview' : step === 2 ? 'Employment Summary' : step === 3 ? 'Contact Summary' : 'Progress'}>
            {step === 5 ? (
              <div className="flex items-center gap-3">
                <span className="h-16 w-16 rounded-full bg-navy text-white grid place-items-center font-bold">{(form.fullName || 'Staff').split(' ').slice(0, 2).map(item => item[0]).join('').toUpperCase()}</span>
                <div>
                  <p className="font-bold text-navy">{form.fullName || 'New Staff'}</p>
                  <p className="text-xs text-slate-500">{form.department || 'Department'} · {form.position || 'Position'}</p>
                  <span className="mt-2 inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">Active</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full border-8 border-indigo-100 grid place-items-center text-xl font-bold text-indigo-700">{progress}%</div>
                <div>
                  <p className="font-bold text-navy">Step {step} of 5</p>
                  <p className="text-xs text-slate-500">{steps[step - 1].title}</p>
                </div>
              </div>
            )}
          </SideCard>
          <SideCard title={step === 5 ? 'Validation Status' : 'Tips'}>
            <Tip text="Upload a clear passport photograph." />
            <Tip text="Ensure required fields marked with * are completed." />
            <Tip text="You can save as draft and continue later." />
            <Tip text="Review all details before creating the record." />
          </SideCard>
          <SideCard title={step === 5 ? 'Validation Alerts' : 'Required Fields'}>
            {step === 5 ? (
              <div className={`rounded-lg p-3 text-sm font-semibold ${requiredMissing.length ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {requiredMissing.length ? `${requiredMissing.length} required field(s) missing.` : 'No validation errors found. You are good to save.'}
              </div>
            ) : (
              <ul className="space-y-2 text-xs text-slate-600">
                {['Full Name', 'Date of Birth', 'Gender', 'Email', 'Phone', 'Department', 'Position / Job Title', 'Date of Employment'].map(item => <li key={item} className="flex gap-2"><span className="text-red-500">*</span>{item}</li>)}
              </ul>
            )}
          </SideCard>
        </aside>
      </div>
    </div>
  )
}

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return <section className="space-y-3"><div><h3 className="section-title">{title}</h3>{sub && <p className="text-xs text-slate-500">{sub}</p>}</div>{children}</section>
}

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-lg border border-slate-200 p-3"><h4 className="mb-3 text-sm font-bold text-navy">{title}</h4><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">{children}</div></div>
}

function Field({ label, value, onChange, type = 'text', icon, required, disabled }: { label: string; value: string; onChange: (value: string) => void; type?: string; icon?: ReactNode; required?: boolean; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-navy">{label} {required && <span className="text-red-500">*</span>}</span>
      <span className="relative block">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
        <input type={type} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className={`input-field ${icon ? 'pl-9' : ''}`} placeholder={label} />
      </span>
    </label>
  )
}

function SelectField({ label, value, options, onChange, required }: { label: string; value: string; options: string[]; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-navy">{label} {required && <span className="text-red-500">*</span>}</span>
      <span className="relative block">
        <select value={value} onChange={event => onChange(event.target.value)} className="input-field appearance-none pr-9">
          <option value="">Select {label.toLowerCase()}</option>
          {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </span>
    </label>
  )
}

function Textarea({ label, value, max, onChange }: { label: string; value: string; max: number; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-navy">{label}</span><textarea value={value} maxLength={max} onChange={event => onChange(event.target.value)} className="input-field h-24 resize-none" placeholder={label} /><span className="block text-right text-xs text-slate-400">{value.length} / {max}</span></label>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3"><span className="font-semibold text-navy">{label}</span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /></label>
}

function SideCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="card p-4"><h3 className="section-title mb-3">{title}</h3>{children}</section>
}

function Tip({ text }: { text: string }) {
  return <div className="flex items-start gap-2 text-xs text-slate-600 mb-2"><CheckCircle2 size={14} className="text-indigo-600 mt-0.5" /> <span>{text}</span></div>
}

function ReviewSection({ title, rows, onEdit }: { title: string; rows: Array<[string, string]>; onEdit: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-navy">{title}</h4>
        <button type="button" onClick={onEdit} className="btn-secondary h-8 px-3 text-xs">Edit</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        {rows.map(([label, value]) => <div key={label} className="grid grid-cols-[160px_minmax(0,1fr)] gap-2"><span className="font-semibold text-navy">{label}</span><span className="text-slate-600">{value || '-'}</span></div>)}
      </div>
    </div>
  )
}
