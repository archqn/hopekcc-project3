import { GoogleLogin } from '@react-oauth/google';
import { CredentialResponse } from '@react-oauth/google';

const LoginButton = () => {

  const onSuccess = (credentialResponse : CredentialResponse) => {
    console.log('[Login Success] currentUser:', credentialResponse.credential);
  };

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
