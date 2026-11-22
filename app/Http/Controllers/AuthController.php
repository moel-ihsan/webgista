<?php

namespace App\Http\Controllers;

use App\Http\Requests\ChangePasswordRequest;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Requests\UploadImageRequest;
use App\Http\Resources\AuthUserResource;
use App\Http\Resources\PublicOfficeProfileResource;
use App\Models\User;
use App\Services\UserProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

class AuthController extends Controller
{
    /**
     * @var UserProfileService
     */
    private $profileService;

    public function __construct(UserProfileService $profileService)
    {
        $this->profileService = $profileService;
    }

    /**
     * Return sanitized public office profile metadata for the dashboard.
     */
    public function init(): JsonResponse
    {
        $user = $this->profileService->getPublicOfficeProfile();

        return response()->json([
            'user' => $user ? (new PublicOfficeProfileResource($user))->resolve() : null,
        ], 200);
    }

    /**
     * Return the currently authenticated web session user, if any.
     */
    public function authUser(): JsonResponse
    {
        $user = Auth::guard('web')->user();

        return response()->json([
            'user' => $user ? (new AuthUserResource($user))->resolve() : null,
        ], 200);
    }

    /**
     * Display the login page.
     */
    public function login(): View
    {
        return view('login');
    }

    /**
     * Authenticate an administrator via email and password.
     */
    public function auth(LoginRequest $request): JsonResponse
    {
        if (Auth::attempt($request->validated())) {
            $request->session()->regenerate();

            return response()->json(['status' => 'Login successful', 'isAuth' => true]);
        }

        return response()->json(['status' => 'Wrong Email / Password', 'isAuth' => false]);
    }

    /**
     * Log out the current user and invalidate the session.
     */
    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('home');
    }

    /**
     * Display the edit profile page for the authenticated user.
     */
    public function edit(Request $request, User $user): View
    {
        abort_unless((int) $request->user()->id === (int) $user->id, 403);

        return view('profile', compact('user'));
    }

    /**
     * Update the authenticated user's office profile metadata.
     */
    public function update(UpdateProfileRequest $request, User $user): JsonResponse
    {
        $validated = $request->validated();
        $updated = $this->profileService->updateProfile($user, $validated);

        return response()->json([
            'image' => $request->file('image'),
            'valid' => $validated,
            'user' => (new PublicOfficeProfileResource($updated))->resolve(),
        ]);
    }

    /**
     * Replace the authenticated user's profile avatar image.
     */
    public function uploadEdit(UploadImageRequest $request, User $user): JsonResponse
    {
        $path = $this->profileService->replaceAvatar($user, $request->file('image'));

        return response()->json(['image' => $path]);
    }

    /**
     * Verify current password and persist the new password hash.
     */
    public function changePassword(ChangePasswordRequest $request, User $user): JsonResponse
    {
        $data = $request->validated();

        if ($this->profileService->changePassword($user, $data['curPas'], $data['newPas'])) {
            return response()->json(['message' => 'Password updated successfully', 'status' => 200]);
        }

        return response()->json(['message' => 'Current password does not match', 'status' => 404]);
    }
}
