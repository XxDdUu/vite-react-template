import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthService } from '../services/AuthService';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/I18nContext';
import LanguageSelector from '../components/LanguageSelector';
import '../index.css';

export default function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    
    // Forgot Password States
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [resetOtp, setResetOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [resetStep, setResetStep] = useState(false);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { isAuthenticated, login: authLogin, googleLogin: authGoogleLogin } = useAuth();
    const { t } = useTranslation();

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/menu', { replace: true });
        }

        /* global google */
        if (typeof google !== 'undefined' && !window.googleInitialized) {
            google.accounts.id.initialize({
                client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                callback: handleGoogleResponse
            });
            window.googleInitialized = true;
        }
        if (typeof google !== 'undefined') {
            const container = document.getElementById("googleBtnContainer");
            if (container) {
                google.accounts.id.renderButton(
                    container,
                    { theme: "outline", size: "large", width: 320 }
                );
            }
        }
    }, [forgotMode, isAuthenticated, navigate]);

    const handleGoogleResponse = async (response) => {
        setLoading(true);
        setError('');
        try {
            await authGoogleLogin(response.credential);
            navigate('/menu', { replace: true });
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Đăng nhập bằng Google thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await authLogin(identifier, password);
            navigate('/menu', { replace: true });
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Đăng nhập thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await AuthService.forgotPassword(forgotEmail);
            alert('Mã khôi phục mật khẩu đã được gửi đến email của bạn.');
            setResetStep(true);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Gửi yêu cầu thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmNewPassword) {
            return setError('Mật khẩu nhập lại không khớp');
        }
        setLoading(true);
        setError('');
        try {
            await AuthService.resetPassword(forgotEmail, resetOtp.trim(), newPassword);
            alert('Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.');
            setForgotMode(false);
            setResetStep(false);
            setIdentifier(forgotEmail);
            setPassword('');
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Đặt lại mật khẩu thất bại');
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        width: '100%', 
        padding: '10px', 
        borderRadius: '6px', 
        border: '1px solid var(--glass-border)', 
        background: 'rgba(0,0,0,0.2)', 
        color: 'white'
    };

    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <header>
                {forgotMode ? (
                    <h1>Khôi phục <span>Mật khẩu</span></h1>
                ) : (
                    <h1>{t('auth.login', 'Đăng nhập')} <span>AlphaOne</span></h1>
                )}
            </header>
            <div className="glass-panel" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                {!forgotMode ? (
                    /* LOGIN MODE */
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div className="control-group">
                            <label>{t('auth.emailOrUsername', 'Email hoặc Tên đăng nhập')}</label>
                            <input 
                                type="text" 
                                style={inputStyle}
                                value={identifier} 
                                onChange={e => setIdentifier(e.target.value)} 
                                required 
                            />
                        </div>

                        <div className="control-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                <label style={{ flexGrow: 1 }}>{t('auth.password', 'Mật khẩu')}</label>
                                <a 
                                    href="#forgot" 
                                    onClick={(e) => { e.preventDefault(); setForgotMode(true); setError(''); }}
                                    style={{ color: 'var(--accent-blue-hover)', textDecoration: 'none', fontSize: '0.85rem' }}
                                >
                                    {t('auth.forgotPassword', 'Quên mật khẩu?')}
                                </a>
                            </div>
                            <input 
                                type="password" 
                                style={inputStyle}
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                required 
                            />
                        </div>

                        {error && <div style={{color: '#ef4444', fontSize: '0.9rem'}}>{error}</div>}

                        <div className="btn-group" style={{marginTop: '10px'}}>
                            <button type="submit" className="primary-btn" disabled={loading}>
                                {loading ? t('common.loading', 'Đang tải...') : t('auth.login', 'Đăng nhập')}
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                            <div id="googleBtnContainer"></div>
                        </div>

                        <div style={{textAlign: 'center', marginTop: '10px'}}>
                            <Link to="/register" style={{color: 'var(--accent-blue-hover)', textDecoration: 'none'}}>
                                {t('auth.noAccount', 'Chưa có tài khoản?')} {t('auth.registerNow', 'Đăng ký ngay')}
                            </Link>
                        </div>
                    </form>
                ) : (
                    /* FORGOT PASSWORD MODE */
                    <div>
                        {!resetStep ? (
                            /* STEP 1: Enter Email */
                            <form onSubmit={handleForgotPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div className="control-group">
                                    <label>Nhập email đăng ký của bạn</label>
                                    <input 
                                        type="email" 
                                        style={inputStyle}
                                        value={forgotEmail} 
                                        onChange={e => setForgotEmail(e.target.value)} 
                                        required 
                                    />
                                </div>

                                {error && <div style={{color: '#ef4444', fontSize: '0.9rem'}}>{error}</div>}

                                <div className="btn-group" style={{marginTop: '10px', display: 'flex', gap: '10px'}}>
                                    <button type="submit" className="primary-btn" disabled={loading} style={{ flex: 1 }}>
                                        {loading ? 'Đang gửi...' : 'Gửi mã xác thực'}
                                    </button>
                                    <button 
                                        type="button" 
                                        className="secondary-btn" 
                                        onClick={() => { setForgotMode(false); setError(''); }}
                                        style={{ 
                                            flex: 1,
                                            padding: '10px', 
                                            borderRadius: '6px', 
                                            border: '1px solid var(--glass-border)', 
                                            background: 'rgba(255,255,255,0.1)', 
                                            color: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Hủy
                                    </button>
                                </div>
                            </form>
                        ) : (
                            /* STEP 2: Enter OTP & New Password */
                            <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div className="control-group">
                                    <label>Mã xác thực (OTP) đã gửi đến {forgotEmail}</label>
                                    <input 
                                        type="text" 
                                        style={inputStyle}
                                        value={resetOtp} 
                                        onChange={e => setResetOtp(e.target.value)} 
                                        required 
                                    />
                                </div>

                                <div className="control-group">
                                    <label>Mật khẩu mới</label>
                                    <input 
                                        type="password" 
                                        style={inputStyle}
                                        value={newPassword} 
                                        onChange={e => setNewPassword(e.target.value)} 
                                        required 
                                    />
                                </div>

                                <div className="control-group">
                                    <label>Xác nhận mật khẩu mới</label>
                                    <input 
                                        type="password" 
                                        style={inputStyle}
                                        value={confirmNewPassword} 
                                        onChange={e => setConfirmNewPassword(e.target.value)} 
                                        required 
                                    />
                                </div>

                                {error && <div style={{color: '#ef4444', fontSize: '0.9rem'}}>{error}</div>}

                                <div className="btn-group" style={{marginTop: '10px', display: 'flex', gap: '10px'}}>
                                    <button type="submit" className="primary-btn" disabled={loading} style={{ flex: 1 }}>
                                        {loading ? 'Đang khôi phục...' : 'Đặt lại mật khẩu'}
                                    </button>
                                    <button 
                                        type="button" 
                                        className="secondary-btn" 
                                        onClick={() => { setResetStep(false); setError(''); }}
                                        style={{ 
                                            flex: 1,
                                            padding: '10px', 
                                            borderRadius: '6px', 
                                            border: '1px solid var(--glass-border)', 
                                            background: 'rgba(255,255,255,0.1)', 
                                            color: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Quay lại
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
