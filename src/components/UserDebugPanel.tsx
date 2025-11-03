import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { Eye, EyeOff, RefreshCw, Copy, CheckCircle } from 'lucide-react'

/**
 * User Debug Panel
 * Shows all users stored in localStorage for troubleshooting login issues
 * Only visible to admin users
 */
export default function UserDebugPanel() {
  const [users, setUsers] = useState<any[]>([])
  const [showPasswords, setShowPasswords] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const loadUsers = () => {
    try {
      const savedUsers = JSON.parse(localStorage.getItem('egumeni_users') || '[]')
      setUsers(savedUsers)
      console.log('👥 All users in localStorage:', savedUsers)
    } catch (error) {
      console.error('Failed to load users:', error)
      setUsers([])
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const maskPassword = (password: string) => {
    if (!password) return 'N/A'
    return showPasswords ? password : '•'.repeat(password.length)
  }

  return (
    <Card className="mt-6 border-yellow-500/50 bg-yellow-50/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-yellow-800">🔍 User Debug Panel</CardTitle>
            <CardDescription>
              View all registered users and their credentials (Admin Only)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPasswords(!showPasswords)}
              className="gap-2"
            >
              {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPasswords ? 'Hide' : 'Show'} Passwords
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadUsers}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4 bg-yellow-100 border-yellow-400">
          <AlertDescription className="text-yellow-800">
            <strong>Total Users:</strong> {users.length} | 
            <strong className="ml-2">Active:</strong> {users.filter(u => u.isActive !== false).length} |
            <strong className="ml-2">Inactive:</strong> {users.filter(u => u.isActive === false).length}
          </AlertDescription>
        </Alert>

        {users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No users found in localStorage. Users will appear here after being created.
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((user, index) => (
              <Card key={user.id || index} className="border-2">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-lg">{user.name || 'No Name'}</h3>
                        <Badge variant={user.isActive !== false ? "default" : "secondary"}>
                          {user.isActive !== false ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {user.role || 'No Role'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-600 min-w-[80px]">Email:</span>
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded flex-1">
                            {user.email || 'N/A'}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(user.email || '', `email-${user.id}`)}
                            className="h-7 w-7 p-0"
                          >
                            {copied === `email-${user.id}` ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-600 min-w-[80px]">Password:</span>
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded flex-1">
                            {maskPassword(user.password)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(user.password || '', `password-${user.id}`)}
                            className="h-7 w-7 p-0"
                          >
                            {copied === `password-${user.id}` ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                        
                        {user.phone && (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-600 min-w-[80px]">Phone:</span>
                            <span>{user.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-semibold text-gray-600">User ID:</span>
                        <span className="ml-2 font-mono text-xs">{user.id || 'N/A'}</span>
                      </div>
                      
                      {user.created_at && (
                        <div>
                          <span className="font-semibold text-gray-600">Created:</span>
                          <span className="ml-2 text-xs">
                            {new Date(user.created_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                      
                      {user.createdAt && user.createdAt !== user.created_at && (
                        <div>
                          <span className="font-semibold text-gray-600">Created (alt):</span>
                          <span className="ml-2 text-xs">
                            {new Date(user.createdAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                      
                      {user.updatedAt && (
                        <div>
                          <span className="font-semibold text-gray-600">Updated:</span>
                          <span className="ml-2 text-xs">
                            {new Date(user.updatedAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                      
                      {user.passwordResetAt && (
                        <div>
                          <span className="font-semibold text-gray-600">Password Reset:</span>
                          <span className="ml-2 text-xs">
                            {new Date(user.passwordResetAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                      
                      <div className="mt-2 pt-2 border-t">
                        <span className="font-semibold text-gray-600">Test Login:</span>
                        <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                          <div>📧 Email: <code className="font-mono">{user.email}</code></div>
                          <div>🔒 Password: <code className="font-mono">{maskPassword(user.password)}</code></div>
                          {user.password && (
                            <div className="mt-1 text-blue-700">
                              Password length: {user.password.length} characters
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
