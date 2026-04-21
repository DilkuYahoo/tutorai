import BaseBadge from '@/components/ui/BaseBadge'

const STAGE_VARIANT = {
  Applied:         'slate',
  Screening:       'indigo',
  Interview:       'indigo',
  'Final Interview': 'amber',
  Offer:           'amber',
  Hired:           'emerald',
  Rejected:        'red',
}

export default function StageBadge({ stage }) {
  return <BaseBadge label={stage} variant={STAGE_VARIANT[stage] ?? 'slate'} />
}
