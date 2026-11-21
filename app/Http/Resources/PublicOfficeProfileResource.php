<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicOfficeProfileResource extends JsonResource
{
    /**
     * Disable outer data wrapping.
     *
     * @var string|null
     */
    public static $wrap = null;

    /**
     * Transform only public-safe office profile attributes.
     *
     * @param  Request  $request
     * @return array<string, mixed>
     */
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'address' => $this->address,
            'lattitude' => $this->lattitude,
            'longitude' => $this->longitude,
            'description' => $this->description,
            'profile_photo_path' => $this->profile_photo_path,
        ];
    }
}
