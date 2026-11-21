<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuthUserResource extends JsonResource
{
    /**
     * Disable outer data wrapping.
     *
     * @var string|null
     */
    public static $wrap = null;

    /**
     * Transform authenticated user attributes for UI state.
     *
     * @param  Request  $request
     * @return array<string, mixed>
     */
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'profile_photo_path' => $this->profile_photo_path,
        ];
    }
}
