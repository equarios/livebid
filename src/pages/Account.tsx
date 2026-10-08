import { useStore } from '../store'

export function Account() {
  const { user, settings, accounts } = useStore()
  const address = accounts.find((a) => a.accountId === user?.accountId)?.address
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{settings.copy.accountTitle}</h1>
          <p className="muted">{settings.copy.accountIntro}</p>
        </div>
      </div>
      <div className="card account-card">
        <dl className="specs">
          <div>
            <dt>Account ID</dt>
            <dd>{user?.accountId}</dd>
          </div>
          <div>
            <dt>Company</dt>
            <dd>{user?.company}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Ship / bill to</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>
              {address || 'Set by Super admin'}
            </dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>
              {user?.role === 'superadmin'
                ? 'Super admin'
                : user?.role === 'admin'
                  ? 'Admin'
                  : 'Client'}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{user?.status || 'active'}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>USD</dd>
          </div>
          <div>
            <dt>Courier</dt>
            <dd>DHL · UPS · FedEx (demo)</dd>
          </div>
          <div>
            <dt>Time zone</dt>
            <dd>Asia/Tokyo (JST)</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
