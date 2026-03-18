import workingImg from '@/assets/working.png';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';

interface ComingSoonProps {
    title: string;
}

const ComingSoon: React.FC<ComingSoonProps> = ({ title }) => {
    const { user } = useAuth();

    return (
        <MainLayout role={user.role} userName={user.name}>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '70vh',
                textAlign: 'center',
                padding: '2rem'
            }}>
                <div style={{
                    maxWidth: '430px',
                    marginBottom: '2rem',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-color)'
                }}>
                    <img 
                        src={workingImg} 
                        alt="Working Overtime" 
                        style={{ width: '100%', display: 'block' }} 
                        onError={(e) => {
                            // Professional fallback if the image doesn't exist yet
                            (e.target as HTMLImageElement).src = 'https://img.freepik.com/free-vector/website-setup-concept-illustration_114360-1049.jpg';
                        }}
                    />
                </div>
                
                <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    {title} is Coming Soon
                </h1>
                
                <p style={{ 
                    fontSize: '1.1rem', 
                    color: 'var(--text-secondary)', 
                    maxWidth: '500px',
                    lineHeight: '1.6'
                }}>
                    We are working hard (including some overtime) to bring this feature to life. 
                    Thank you for your patience!
                </p>

                <div style={{ marginTop: '2.5rem' }}>
                    <button 
                        className="btn btn-primary" 
                        onClick={() => window.history.back()}
                    >
                        Go Back
                    </button>
                </div>
            </div>
        </MainLayout>
    );
};

export default ComingSoon;
