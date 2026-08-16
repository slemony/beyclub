import { useState } from 'react'
import Modal from './Modal'

type Props = {
  /** What's being deleted, named — "Delete build", "Delete deck". */
  label: string
  /** The consequence, spelled out. A confirm that only says "are you sure?" tells you nothing. */
  question: string
  onConfirm: () => void
}

/**
 * A delete that asks first, in a dialog of its own above whatever sheet the
 * button lives in. There is no undo behind these — a deleted build is gone
 * from every device once it syncs — so this is the only thing between a
 * misplaced tap and losing work. Cancel is the wide, obvious target.
 */
export default function ConfirmDelete({ label, question, onConfirm }: Props) {
  const [asking, setAsking] = useState(false)

  return (
    <>
      <button className="collection-back deck-delete" onClick={() => setAsking(true)}>
        {label}
      </button>

      {asking && (
        <Modal label={label} onClose={() => setAsking(false)}>
          <h3 className="modal-title">{label}?</h3>
          <p className="modal-body">{question}</p>
          <div className="modal-actions">
            <button className="modal-btn danger" onClick={onConfirm}>
              Delete
            </button>
            <button className="modal-btn" onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
