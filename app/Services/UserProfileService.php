<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class UserProfileService
{
    /**
     * Get the primary office profile record displayed on the public dashboard.
     */
    public function getPublicOfficeProfile(): ?User
    {
        return User::first();
    }

    /**
     * Update the office profile metadata.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateProfile(User $user, array $data): User
    {
        $user->update($data);

        return $user->fresh();
    }

    /**
     * Replace the user's profile avatar on the public storage disk.
     */
    public function replaceAvatar(User $user, UploadedFile $file): string
    {
        $disk = Storage::disk('public');

        if ($user->profile_photo_path && $disk->exists($user->profile_photo_path)) {
            $disk->delete($user->profile_photo_path);
        }

        $extension = $file->extension() ?: 'jpg';
        $filename = uniqid().'.'.$extension;
        $relativePath = 'user/image/'.$filename;

        $file->storeAs('user/image', $filename, 'public');
        $user->update(['profile_photo_path' => $relativePath]);

        return 'public/'.$relativePath;
    }

    /**
     * Verify the current password and update to the new hashed password.
     */
    public function changePassword(User $user, string $currentPassword, string $newPassword): bool
    {
        if (! Hash::check($currentPassword, (string) $user->password)) {
            return false;
        }

        $user->update(['password' => Hash::make($newPassword)]);

        return true;
    }
}
