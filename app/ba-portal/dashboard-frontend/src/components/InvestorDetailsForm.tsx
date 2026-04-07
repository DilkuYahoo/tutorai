import React, { useState } from 'react';
import { User, Mail, Phone, Calendar, MapPin, Save, X, Copy } from 'lucide-react';

interface InvestorPersonalDetails {
  name: string;
  email: string;
  mobile: string;
  dob: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
}

interface InvestorDetailsFormProps {
  investors: any[];
  onSave: (updatedInvestors: any[]) => void;
  onClose: () => void;
}

const ADDRESS_KEYS: Array<keyof InvestorPersonalDetails> = ['address', 'suburb', 'state', 'postcode'];

const PERSONAL_FIELDS: Array<{
  key: keyof InvestorPersonalDetails;
  label: string;
  type: string;
  placeholder: string;
  icon: React.ReactNode;
  fullWidth?: boolean;
  autoComplete: string;
}> = [
  { key: 'name',   label: 'Full Name',       type: 'text',  placeholder: 'Full name',           icon: <User size={14} />,     fullWidth: true, autoComplete: 'name' },
  { key: 'dob',    label: 'Date of Birth',   type: 'date',  placeholder: '',                    icon: <Calendar size={14} />,              autoComplete: 'bday' },
  { key: 'email',  label: 'Email Address',   type: 'email', placeholder: 'email@example.com',   icon: <Mail size={14} />,                  autoComplete: 'email' },
  { key: 'mobile', label: 'Mobile Number',   type: 'tel',   placeholder: '04XX XXX XXX',        icon: <Phone size={14} />,                 autoComplete: 'tel' },
];

const ADDRESS_FIELDS: Array<{
  key: keyof InvestorPersonalDetails;
  label: string;
  placeholder: string;
  fullWidth?: boolean;
  autoComplete: string;
}> = [
  { key: 'address',  label: 'Street Address', placeholder: '123 Example St', fullWidth: true, autoComplete: 'street-address' },
  { key: 'suburb',   label: 'Suburb / City',  placeholder: 'Suburb',                          autoComplete: 'address-level2' },
  { key: 'state',    label: 'State',          placeholder: 'e.g. VIC',                        autoComplete: 'address-level1' },
  { key: 'postcode', label: 'Postcode',       placeholder: '3000',                            autoComplete: 'postal-code' },
];

const emptyDetails = (investor: any): InvestorPersonalDetails => ({
  name:     investor.name     || '',
  email:    investor.email    || '',
  mobile:   investor.mobile   || '',
  dob:      investor.dob      || '',
  address:  investor.address  || '',
  suburb:   investor.suburb   || '',
  state:    investor.state    || '',
  postcode: investor.postcode || '',
});

const InvestorDetailsForm: React.FC<InvestorDetailsFormProps> = ({ investors, onSave, onClose }) => {
  const [localInvestors, setLocalInvestors] = useState<InvestorPersonalDetails[]>(
    investors.map(emptyDetails)
  );
  // Tracks which investor indices are using the shared address from investor 0
  const [sharedAddress, setSharedAddress] = useState<Set<number>>(new Set());

  const updateField = (investorIndex: number, field: keyof InvestorPersonalDetails, value: string) => {
    setLocalInvestors(prev => {
      const updated = [...prev];
      updated[investorIndex] = { ...updated[investorIndex], [field]: value };

      // If this is investor 0 updating an address field, propagate to all linked investors
      if (investorIndex === 0 && ADDRESS_KEYS.includes(field)) {
        sharedAddress.forEach(linkedIdx => {
          updated[linkedIdx] = { ...updated[linkedIdx], [field]: value };
        });
      }

      return updated;
    });
  };

  const toggleSharedAddress = (investorIndex: number, checked: boolean) => {
    setSharedAddress(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(investorIndex);
        // Copy address from investor 0 immediately
        setLocalInvestors(cur => {
          const updated = [...cur];
          const source = updated[0];
          updated[investorIndex] = {
            ...updated[investorIndex],
            address:  source.address,
            suburb:   source.suburb,
            state:    source.state,
            postcode: source.postcode,
          };
          return updated;
        });
      } else {
        next.delete(investorIndex);
      }
      return next;
    });
  };

  const handleSave = () => {
    const merged = investors.map((inv, i) => ({
      ...inv,
      ...localInvestors[i],
    }));
    onSave(merged);
  };

  const inputStyle = {
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    borderColor: 'var(--border-color)',
  };

  const inputStyleDisabled = {
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    borderColor: 'var(--border-color)',
    cursor: 'not-allowed' as const,
  };

  const cardStyle = {
    backgroundColor: 'var(--bg-secondary)',
    borderColor: 'var(--border-color)',
  };

  const isShared = (idx: number) => sharedAddress.has(idx);
  const primaryName = localInvestors[0]?.name || 'Investor 1';

  return (
    <div
      className="min-h-full p-4 md:p-8"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Investor Details
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Update personal contact and identity information for each investor.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Investor cards */}
        <div className="space-y-6">
          {investors.map((_investor, investorIndex) => (
            <div
              key={investorIndex}
              className="rounded-xl border p-6"
              style={cardStyle}
            >
              {/* Card header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <User size={20} className="text-cyan-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                    {localInvestors[investorIndex].name || `Investor ${investorIndex + 1}`}
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Investor {investorIndex + 1}</p>
                </div>
              </div>

              {/* Personal fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PERSONAL_FIELDS.map((field) => (
                  <div key={field.key} className={field.fullWidth ? 'md:col-span-2' : ''}>
                    <label
                      className="flex items-center gap-1.5 text-xs font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {field.icon}
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      value={localInvestors[investorIndex][field.key]}
                      onChange={(e) => updateField(investorIndex, field.key, e.target.value)}
                      placeholder={field.placeholder}
                      autoComplete={field.autoComplete}
                      className="w-full rounded-lg px-3 py-2 text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>

              {/* Address section */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    <MapPin size={14} />
                    Address
                  </div>

                  {/* Shared address toggle — only shown for investor 2+ */}
                  {investorIndex > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer select-none group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isShared(investorIndex)}
                          onChange={(e) => toggleSharedAddress(investorIndex, e.target.checked)}
                        />
                        <div
                          className={`w-9 h-5 rounded-full transition-colors ${isShared(investorIndex) ? 'bg-cyan-500' : ''}`}
                          style={!isShared(investorIndex) ? { backgroundColor: 'var(--bg-tertiary)' } : {}}
                        />
                        <div
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isShared(investorIndex) ? 'translate-x-4' : 'translate-x-0'}`}
                        />
                      </div>
                      <span className="flex items-center gap-1 text-xs" style={{ color: isShared(investorIndex) ? '#06b6d4' : 'var(--text-secondary)' }}>
                        <Copy size={11} />
                        Same as {primaryName}
                      </span>
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ADDRESS_FIELDS.map((field) => (
                    <div key={field.key} className={field.fullWidth ? 'md:col-span-2' : ''}>
                      <label
                        className="block text-xs font-medium mb-1.5"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {field.label}
                      </label>
                      <input
                        type="text"
                        value={localInvestors[investorIndex][field.key]}
                        onChange={(e) => updateField(investorIndex, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        autoComplete={field.autoComplete}
                        disabled={isShared(investorIndex)}
                        className="w-full rounded-lg px-3 py-2 text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-60"
                        style={isShared(investorIndex) ? inputStyleDisabled : inputStyle}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 mt-8 pb-8">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm font-medium border transition-colors"
            style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)', backgroundColor: 'transparent' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Save size={15} />
            Save Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvestorDetailsForm;
