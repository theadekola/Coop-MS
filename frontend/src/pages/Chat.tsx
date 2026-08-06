import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import toast from 'react-hot-toast'
import { Bell, BellOff, ChevronRight, Download, FileText, Filter, MoreVertical, Paperclip, Phone, Plus, RefreshCw, Search, Send, Settings, Smile, Trash2, User, Users, Video, X } from 'lucide-react'
import { chatApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import type { ChatConversation, ChatMessage } from '../types'

type ChatFilter = 'all' | 'direct' | 'groups' | 'channels'
type DetailTab = 'details' | 'files' | 'members'
type CallMode = 'audio' | 'video' | null

function initials(name: string) {
  return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || '?'
}

function roomTypeLabel(type: ChatConversation['type']) {
  if (type === 'group') return 'Group'
  if (type === 'channel') return 'Channel'
  return 'Direct'
}

function roomTypeForFilter(filter: ChatFilter): ChatConversation['type'] | null {
  if (filter === 'groups') return 'group'
  if (filter === 'channels') return 'channel'
  if (filter === 'direct') return 'direct'
  return null
}

function fileIcon(fileName?: string) {
  if (!fileName) return <FileText size={22} className="text-slate-600" />
  if (/\.(xls|xlsx|csv)$/i.test(fileName)) return <FileText size={22} className="text-green-700" />
  if (/\.pdf$/i.test(fileName)) return <FileText size={22} className="text-red-700" />
  return <FileText size={22} className="text-blue-700" />
}

export default function Chat() {
  const { user } = useAuthStore()
  const [activeConv, setActiveConv] = useState<ChatConversation | null>(null)
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomType, setNewRoomType] = useState<ChatConversation['type']>('group')
  const [showNewChat, setShowNewChat] = useState(false)
  const [filter, setFilter] = useState<ChatFilter>('all')
  const [detailTab, setDetailTab] = useState<DetailTab>('details')
  const [callMode, setCallMode] = useState<CallMode>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [notificationsOn, setNotificationsOn] = useState(true)
  const [muteConversation, setMuteConversation] = useState(false)
  const [pinConversation, setPinConversation] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageSearchRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => { loadRooms() }, [])

  useEffect(() => {
    if (activeConv) loadMessages(activeConv.id)
  }, [activeConv?.id])

  useEffect(() => {
    setDetailTab('details')
    setShowMoreMenu(false)
    setGlobalSearch('')
  }, [activeConv?.id])

  const loadRooms = async () => {
    try {
      setLoading(true)
      const rooms = await chatApi.rooms()
      setConversations(rooms)
      setActiveConv(current => current || rooms[0] || null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load chats')
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (roomId: number) => {
    try {
      setMessagesLoading(true)
      setMessages(await chatApi.messages(roomId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load messages')
    } finally {
      setMessagesLoading(false)
    }
  }

  const createRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error('Enter a chat name first')
      return
    }
    try {
      await chatApi.createRoom({ name: newRoomName.trim(), type: newRoomType })
      setNewRoomName('')
      setShowNewChat(false)
      await loadRooms()
      toast.success('Chat created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create chat')
    }
  }

  const send = async () => {
    if (!input.trim() || !activeConv) return
    const content = input.trim()
    setInput('')
    try {
      const sent = await chatApi.sendMessage(activeConv.id, content)
      setMessages(prev => [...prev, sent])
      setConversations(prev => prev.map(room => room.id === activeConv.id ? { ...room, lastMessage: content, timestamp: sent.timestamp } : room))
    } catch (err) {
      setInput(content)
      toast.error(err instanceof Error ? err.message : 'Could not send message')
    }
  }

  const attachFile = async (file: File) => {
    if (!activeConv) {
      toast.error('Select a chat first')
      return
    }
    try {
      const sent = await chatApi.sendMessage(activeConv.id, file.name, { type: 'file', fileName: file.name, fileSize: file.size })
      setMessages(prev => [...prev, sent])
      setConversations(prev => prev.map(room => room.id === activeConv.id ? { ...room, lastMessage: `Shared file: ${file.name}`, timestamp: sent.timestamp } : room))
      setDetailTab('files')
      toast.success('File attached to chat')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not attach file')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const downloadMessageFile = (message: ChatMessage) => {
    const url = URL.createObjectURL(new Blob([message.content || message.fileName || ''], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = message.fileName || `chat-message-${message.id}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const clearVisibleMessages = () => {
    setMessages([])
    toast.success('Chat cleared from this view')
  }

  const exportTranscript = () => {
    if (!activeConv) return
    const lines = messages.map(message => {
      const label = message.type === 'file' ? `[file: ${message.fileName || message.content}]` : message.content
      return `${message.timestamp} ${message.senderName}: ${label}`
    })
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeConv.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-chat.txt`
    link.click()
    URL.revokeObjectURL(url)
    setShowMoreMenu(false)
  }

  const focusMessageSearch = () => {
    messageSearchRef.current?.focus()
    messageSearchRef.current?.select()
  }

  const filteredConvs = useMemo(() => {
    const term = search.trim().toLowerCase()
    const selectedType = roomTypeForFilter(filter)
    return conversations.filter(room => {
      const typeMatches = !selectedType || room.type === selectedType
      const searchMatches = !term || room.name.toLowerCase().includes(term) || room.lastMessage.toLowerCase().includes(term)
      return typeMatches && searchMatches
    })
  }, [conversations, filter, search])

  const visibleMessages = useMemo(() => {
    const term = globalSearch.trim().toLowerCase()
    if (!term) return messages
    return messages.filter(message => [message.senderName, message.content, message.fileName].some(value => String(value || '').toLowerCase().includes(term)))
  }, [messages, globalSearch])

  const files = messages.filter(message => message.type === 'file')
  const activeRole = activeConv?.role || roomTypeLabel(activeConv?.type || 'group')

  return (
    <div className="h-[calc(100dvh-56px)] bg-white grid grid-cols-1 grid-rows-[minmax(0,38dvh)_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)_310px] xl:grid-rows-1 overflow-hidden">
      <aside className="border-r border-slate-200 flex flex-col min-h-0">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-navy">Chats</h2>
            <button onClick={() => setShowNewChat(true)} className="btn-primary bg-navy"><Plus size={14} /> New Chat</button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={event => setSearch(event.target.value)} className="input-field pl-9" placeholder="Search chats..." />
            </div>
            <button onClick={() => setFilter(filter === 'all' ? 'direct' : 'all')} className="w-11 h-11 border border-slate-200 rounded-lg flex items-center justify-center hover:bg-slate-50" title="Toggle filter">
              <Filter size={16} className="text-coop-blue" />
            </button>
          </div>
          <div className="flex gap-2 mt-4">
            {(['all', 'direct', 'groups', 'channels'] as const).map(item => (
              <button key={item} onClick={() => setFilter(item)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === item ? 'bg-coop-blue text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {item === 'all' ? 'All' : item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-5 text-sm text-slate-500">Loading chats...</div>}
          {!loading && filteredConvs.length === 0 && <div className="p-5 text-sm text-slate-500">No chats found.</div>}
          {filteredConvs.map(room => (
            <button key={room.id} onClick={() => setActiveConv(room)} className={`w-full p-4 flex items-center gap-3 border-b border-slate-100 text-left hover:bg-slate-50 ${activeConv?.id === room.id ? 'bg-blue-50' : ''}`}>
              <div className="relative flex-shrink-0">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${room.type === 'direct' ? 'bg-navy text-white' : room.type === 'group' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-coop-blue'}`}>
                  {room.type === 'direct' ? <span className="font-bold text-sm">{initials(room.name)}</span> : <Users size={20} />}
                </div>
                {room.isOnline && <span className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-navy truncate">{room.name}</span>
                  <span className="text-xs text-slate-500">{room.timestamp}</span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-1">{room.lastMessage || 'No messages yet'}</p>
              </div>
              {room.unreadCount > 0 && <span className="w-6 h-6 rounded-full bg-coop-blue text-white text-xs font-bold flex items-center justify-center">{room.unreadCount}</span>}
            </button>
          ))}
        </div>
      </aside>

      <main className="flex flex-col min-h-0 bg-slate-50">
        {activeConv ? (
          <>
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-navy text-white flex items-center justify-center font-bold">{initials(activeConv.name)}</div>
                  {activeConv.isOnline && <span className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />}
                </div>
                <div>
                  <h3 className="font-bold text-navy">{activeConv.name}</h3>
                  <div className="text-xs text-green-600">{activeConv.isOnline ? 'Online' : roomTypeLabel(activeConv.type)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCallMode('audio')} className="w-10 h-10 rounded-full bg-blue-50 text-coop-blue flex items-center justify-center hover:bg-blue-100" title="Audio call"><Phone size={17} /></button>
                <button onClick={() => setCallMode('video')} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center" title="Video call"><Video size={18} /></button>
                <button onClick={focusMessageSearch} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center" title="Search chat"><Search size={18} /></button>
                <div className="relative">
                  <button onClick={() => setShowMoreMenu(value => !value)} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center" title="More actions"><MoreVertical size={18} /></button>
                  {showMoreMenu && (
                    <div className="absolute right-0 top-11 w-48 rounded-xl border border-slate-200 bg-white shadow-lg z-20 p-2">
                      <button onClick={() => { loadRooms(); activeConv && loadMessages(activeConv.id); setShowMoreMenu(false) }} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-navy hover:bg-slate-50"><RefreshCw size={14} /> Refresh chat</button>
                      <button onClick={exportTranscript} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-navy hover:bg-slate-50"><Download size={14} /> Export transcript</button>
                      <button onClick={() => { clearVisibleMessages(); setShowMoreMenu(false) }} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 size={14} /> Clear view</button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            <div className="px-5 py-3 bg-white border-b border-slate-100">
              <div className="relative max-w-xl mx-auto">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input ref={messageSearchRef} value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} className="input-field pl-9" placeholder="Search messages, people or files..." />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="text-center text-xs font-semibold text-navy">Today</div>
              {messagesLoading && <div className="text-center text-sm text-slate-500">Loading messages...</div>}
              {!messagesLoading && visibleMessages.length === 0 && <div className="text-center text-sm text-slate-400 py-8">No messages in this chat yet.</div>}
              {visibleMessages.map(message => {
                const isMine = message.senderId === user?.id
                return (
                  <div key={message.id} className={`flex gap-3 ${isMine ? 'justify-end' : 'justify-start'}`}>
                    {!isMine && <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{initials(message.senderName)}</div>}
                    <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {message.type === 'file' ? (
                        <div className="bg-white border border-slate-200 rounded-xl p-3 min-w-[280px] flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">{fileIcon(message.fileName)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-navy truncate">{message.fileName || 'File attachment'}</div>
                            <div className="text-xs text-slate-500">{message.fileSize || 'File'}</div>
                          </div>
                          <button onClick={() => downloadMessageFile(message)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100"><Download size={15} className="text-coop-blue" /></button>
                        </div>
                      ) : (
                        <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${isMine ? 'bg-blue-50 text-navy border border-blue-100' : 'bg-white text-navy border border-slate-200'}`}>
                          {message.content}
                        </div>
                      )}
                      <span className="text-xs text-slate-400">{message.timestamp}</span>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <footer className="p-5 bg-white border-t border-slate-200">
              <div className="flex items-center gap-3">
                <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center" title="Attach file"><Paperclip size={18} className="text-slate-500" /></button>
                <div className="relative flex-1">
                  <input value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } }} className="input-field pr-10" placeholder="Type a message..." />
                  <button onClick={() => setInput(prev => `${prev} :)`)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><Smile size={18} /></button>
                </div>
                <button onClick={send} className="w-11 h-11 rounded-full bg-coop-blue text-white flex items-center justify-center hover:bg-blue-700"><Send size={18} /></button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500">Create a chat to start messaging.</div>
        )}
      </main>

      <aside className="hidden xl:flex border-l border-slate-200 bg-white flex-col min-h-0">
        {activeConv ? (
          <>
            <div className="grid grid-cols-3 border-b border-slate-200">
              {(['details', 'files', 'members'] as DetailTab[]).map(tab => (
                <button key={tab} onClick={() => setDetailTab(tab)} className={`py-4 text-sm font-semibold capitalize ${detailTab === tab ? 'text-navy border-b-2 border-coop-blue' : 'text-slate-500 hover:text-navy'}`}>{tab}</button>
              ))}
            </div>

            {detailTab === 'details' && (
              <>
                <div className="p-5 text-center border-b border-slate-200">
                  <div className="relative w-20 h-20 mx-auto">
                    <div className="w-20 h-20 rounded-full bg-navy text-white flex items-center justify-center text-xl font-bold">{initials(activeConv.name)}</div>
                    {activeConv.isOnline && <span className="absolute right-1 bottom-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white" />}
                  </div>
                  <h3 className="font-bold text-navy mt-3">{activeConv.name}</h3>
                  <div className="text-xs text-green-600 mt-1">{activeConv.isOnline ? 'Online' : roomTypeLabel(activeConv.type)}</div>
                  <div className="text-sm text-slate-600 mt-1">{activeRole}</div>
                  <div className="grid grid-cols-4 gap-3 mt-5">
                    <DetailAction icon={<Phone size={17} />} label="Audio Call" onClick={() => setCallMode('audio')} />
                    <DetailAction icon={<Video size={17} />} label="Video Call" onClick={() => setCallMode('video')} />
                    <DetailAction icon={<User size={17} />} label="Profile" onClick={() => setShowProfile(true)} />
                    <DetailAction icon={<MoreVertical size={17} />} label="More" onClick={exportTranscript} />
                  </div>
                </div>

                <div className="p-5 border-b border-slate-200">
                  <h4 className="font-bold text-navy mb-3">About</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{activeConv.role || `${roomTypeLabel(activeConv.type)} conversation for cooperative communication.`}</p>
                </div>

                <div className="p-5 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-navy">Media, Links & Files</h4>
                    <button onClick={() => setDetailTab('files')} className="text-sm font-semibold text-coop-blue">See all</button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {files.slice(0, 3).map(file => (
                      <button key={file.id} onClick={() => downloadMessageFile(file)} className="border border-slate-200 rounded-xl p-3 text-center hover:bg-slate-50">
                        <div className="w-10 h-10 mx-auto rounded-lg bg-slate-50 flex items-center justify-center">{fileIcon(file.fileName)}</div>
                        <div className="text-[11px] text-navy mt-2 truncate">{file.fileName}</div>
                        <div className="text-[10px] text-slate-400">{file.fileSize}</div>
                      </button>
                    ))}
                    {files.length === 0 && <div className="col-span-3 text-sm text-slate-400">No files shared yet.</div>}
                  </div>
                </div>

                <div className="p-5 border-b border-slate-200 space-y-4">
                  <h4 className="font-bold text-navy">Chat Settings</h4>
                  <ToggleRow icon={<Bell size={16} />} label="Notifications" checked={notificationsOn} onClick={() => setNotificationsOn(value => !value)} />
                  <ToggleRow icon={<BellOff size={16} />} label="Mute Conversation" checked={muteConversation} onClick={() => setMuteConversation(value => !value)} />
                  <ToggleRow icon={<Settings size={16} />} label="Pin Conversation" checked={pinConversation} onClick={() => setPinConversation(value => !value)} />
                  <button onClick={clearVisibleMessages} className="w-full flex items-center justify-between text-sm text-navy hover:text-red-600">
                    <span className="flex items-center gap-3"><Trash2 size={16} /> Clear Chat</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}

            {detailTab === 'files' && (
              <div className="p-5 space-y-3 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-navy">Files</h4>
                  <button onClick={() => fileInputRef.current?.click()} className="text-sm font-semibold text-coop-blue">Attach file</button>
                </div>
                {files.map(file => (
                  <button key={file.id} onClick={() => downloadMessageFile(file)} className="w-full border border-slate-200 rounded-xl p-3 text-left hover:bg-slate-50 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">{fileIcon(file.fileName)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-navy truncate">{file.fileName || file.content}</span>
                      <span className="block text-xs text-slate-500">{file.fileSize || 'File'} by {file.senderName}</span>
                    </span>
                    <Download size={15} className="text-coop-blue" />
                  </button>
                ))}
                {files.length === 0 && <p className="text-sm text-slate-400">No files shared yet.</p>}
              </div>
            )}

            {detailTab === 'members' && (
              <div className="p-5 space-y-3">
                <h4 className="font-bold text-navy">Members</h4>
                <div className="rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold">{initials(user?.fullName || user?.email || 'Me')}</span>
                  <span>
                    <span className="block text-sm font-bold text-navy">{user?.fullName || user?.email || 'Current User'}</span>
                    <span className="block text-xs text-slate-500">You</span>
                  </span>
                </div>
                <p className="text-sm text-slate-500">{activeConv.role || 'Member list loaded from the current chat room.'}</p>
              </div>
            )}
          </>
        ) : (
          <div className="p-5 text-sm text-slate-500">Select a chat to view details.</div>
        )}
      </aside>

      <input ref={fileInputRef} type="file" className="hidden" onChange={event => event.target.files?.[0] && attachFile(event.target.files[0])} />

      {showNewChat && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-navy">New Chat</h3>
            <p className="text-sm text-slate-500 mt-1">Create a chat room for messages and files.</p>
            <input value={newRoomName} onChange={event => setNewRoomName(event.target.value)} className="input-field mt-5" placeholder="Chat name" autoFocus />
            <select value={newRoomType} onChange={event => setNewRoomType(event.target.value as ChatConversation['type'])} className="input-field mt-3">
              <option value="group">Group</option>
              <option value="channel">Channel</option>
              <option value="direct">Direct</option>
            </select>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNewChat(false)} className="flex-1 btn-secondary justify-center">Cancel</button>
              <button onClick={createRoom} className="flex-1 btn-primary bg-navy justify-center">Create Chat</button>
            </div>
          </div>
        </div>
      )}

      {callMode && activeConv && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 text-center">
            <button onClick={() => setCallMode(null)} className="ml-auto flex w-8 h-8 items-center justify-center rounded-full hover:bg-slate-100"><X size={16} /></button>
            <div className="w-20 h-20 rounded-full bg-navy text-white flex items-center justify-center text-xl font-bold mx-auto">{initials(activeConv.name)}</div>
            <h3 className="text-lg font-bold text-navy mt-4">{activeConv.name}</h3>
            <p className="text-sm text-slate-500 mt-1">{callMode === 'audio' ? 'Audio call ready' : 'Video call ready'}</p>
            <div className="flex justify-center gap-3 mt-6">
              <button onClick={() => toast.success(`${callMode === 'audio' ? 'Audio' : 'Video'} call started`)} className="btn-primary bg-coop-blue justify-center">{callMode === 'audio' ? <Phone size={16} /> : <Video size={16} />} Start</button>
              <button onClick={() => setCallMode(null)} className="btn-secondary justify-center">End</button>
            </div>
          </div>
        </div>
      )}

      {showProfile && activeConv && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-navy">{activeConv.name}</h3>
                <p className="text-sm text-slate-500">{roomTypeLabel(activeConv.type)} profile</p>
              </div>
              <button onClick={() => setShowProfile(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Room Type" value={roomTypeLabel(activeConv.type)} />
              <InfoRow label="Members" value={activeConv.role || '1 member(s)'} />
              <InfoRow label="Last Message" value={activeConv.lastMessage || 'No messages yet'} />
              <InfoRow label="Files" value={`${files.length}`} />
            </div>
            <button onClick={() => { setShowProfile(false); setDetailTab('members') }} className="btn-primary bg-navy justify-center w-full mt-5">View Members</button>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="text-sm font-bold text-navy mt-1 break-words">{value}</div></div>
}

function DetailAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-center">
      <span className="w-11 h-11 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-navy">{icon}</span>
      <span className="text-[11px] text-navy mt-2 block">{label}</span>
    </button>
  )
}

function ToggleRow({ icon, label, checked, onClick }: { icon: ReactNode; label: string; checked: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between text-sm text-navy">
      <span className="flex items-center gap-3">{icon} {label}</span>
      <span className={`w-10 h-5 rounded-full flex items-center p-0.5 ${checked ? 'bg-coop-blue justify-end' : 'bg-slate-300 justify-start'}`}>
        <span className="w-4 h-4 bg-white rounded-full shadow" />
      </span>
    </button>
  )
}
