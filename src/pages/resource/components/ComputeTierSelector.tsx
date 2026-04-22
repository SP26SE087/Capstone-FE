import React, { useEffect, useState } from 'react';
import { Cpu, HardDrive, MemoryStick, Zap, Check, AlertCircle, Clock } from 'lucide-react';
import { ComputeTier } from '@/types/booking';
import { computeService } from '@/services/computeService';

interface ComputeTierSelectorProps {
  selectedTierId: string | null;
  onSelectTier: (tier: ComputeTier) => void;
  disabled?: boolean;
}

const ComputeTierSelector: React.FC<ComputeTierSelectorProps> = ({
  selectedTierId,
  onSelectTier,
  disabled = false
}) => {
  const [tiers, setTiers] = useState<ComputeTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTiers = async () => {
      try {
        setLoading(true);
        const data = await computeService.getTiers();
        setTiers(data);
        setError(null);
      } catch (err) {
        setError('Failed to load compute tiers');
        console.error('Error fetching compute tiers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTiers();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="premium-loader" style={{ margin: '0 auto', width: '48px', height: '48px' }}>
          <div />
        </div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading compute tiers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '1.5rem',
        background: 'var(--danger-bg)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: 'var(--danger)'
      }}>
        <AlertCircle size={20} />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem',
        marginBottom: '0.5rem'
      }}>
        <Cpu size={18} style={{ color: 'var(--accent-color)' }} />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Select Compute Tier</span>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem'
      }}>
        {tiers.map((tier) => {
          const isSelected = selectedTierId === tier.id;
          const isDisabled = disabled || !tier.available;

          return (
            <div
              key={tier.id}
              onClick={() => !isDisabled && onSelectTier(tier)}
              style={{
                position: 'relative',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${isSelected ? 'var(--accent-color)' : 'var(--border-color)'}`,
                background: isSelected ? 'var(--accent-bg)' : 'var(--card-bg)',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.5 : 1,
                transition: 'all 0.2s ease',
                ...((!isDisabled && !isSelected) && {
                  ':hover': {
                    borderColor: 'var(--accent-light)',
                    boxShadow: 'var(--shadow-md)'
                  }
                })
              }}
              onMouseEnter={(e) => {
                if (!isDisabled && !isSelected) {
                  e.currentTarget.style.borderColor = 'var(--accent-light)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDisabled && !isSelected) {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--accent-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <Check size={14} />
                </div>
              )}

              {/* Availability badge */}
              {!tier.available && (
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--warning-bg)',
                  color: 'var(--warning)',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  Unavailable
                </div>
              )}

              {/* Tier header */}
              <div style={{ marginBottom: '1rem', paddingRight: isSelected || !tier.available ? '2rem' : 0 }}>
                <h4 style={{ 
                  margin: 0, 
                  fontSize: '1.1rem', 
                  fontWeight: 700,
                  color: 'var(--text-primary)'
                }}>
                  {tier.name}
                </h4>
                <p style={{ 
                  margin: '0.25rem 0 0', 
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4
                }}>
                  {tier.description}
                </p>
              </div>

              {/* Tier specs */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--info-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--info)'
                  }}>
                    <Zap size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>GPU</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{tier.gpuCount}x {tier.gpuModel.split(' ').pop()}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--success-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--success)'
                  }}>
                    <Cpu size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>CPU</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{tier.cpuCores} Cores</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--warning-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--warning)'
                  }}>
                    <MemoryStick size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>RAM</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{tier.ramGB} GB</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-color)'
                  }}>
                    <HardDrive size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Storage</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{tier.storageGB} GB</div>
                  </div>
                </div>
              </div>

              {/* Tier footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-light)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  <Clock size={12} />
                  <span>Max {tier.maxDurationHours}h</span>
                </div>
                {tier.pricePerHour !== undefined && (
                  <div style={{
                    fontWeight: 700,
                    color: 'var(--accent-color)',
                    fontSize: '0.9rem'
                  }}>
                    ${tier.pricePerHour.toFixed(2)}/hr
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ComputeTierSelector;
