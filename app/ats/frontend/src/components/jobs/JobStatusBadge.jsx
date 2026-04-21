import BaseBadge from '@/components/ui/BaseBadge'

const STATUS_VARIANT = {
  Open:     'emerald',
  Draft:    'slate',
  Closed:   'red',
  'On Hold': 'amber',
  Archived: 'slate',
}

export default function JobStatusBadge({ status }) {
  return <BaseBadge label={status} variant={STATUS_VARIANT[status] ?? 'slate'} />
}
