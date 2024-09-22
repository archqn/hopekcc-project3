import { GoogleLogin } from '@react-oauth/google';
import { CredentialResponse } from '@react-oauth/google';

interface LoginButtonProps {
  onSuccess: (credentialResponse: CredentialResponse) => void;
}


const LoginButton: React.FC<LoginButtonProps> = ({ onSuccess }) => {

  const onError = () => {
    console.log('[Login Failed]');
  };
  return(
    <div id="signInButton">
      <GoogleLogin
        onSuccess={onSuccess}
        onError={onError}
      />
    </div>
  );
}

export default LoginButton;
