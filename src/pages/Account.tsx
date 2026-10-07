import { useStore } from '../store'

export function Account() {
  const { user } = useStore()
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Account</h1>
          <p className="muted">Member profile for this demo workspace.</p>
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
            <dt>Role</dt>
            <dd>{user?.role || 'member'}</dd>
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
