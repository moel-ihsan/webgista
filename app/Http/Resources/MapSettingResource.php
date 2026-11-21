<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MapSettingResource extends JsonResource
{
    /**
     * Disable outer data wrapping for v1 frontend compatibility.
     *
     * @var string|null
     */
    public static $wrap = null;

    /**
     * Transform the resource into an array.
     *
     * @param  Request  $request
     * @return array<string, mixed>
     */
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'lattitude' => $this->lattitude,
            'longitude' => $this->longitude,
            'zoom' => $this->zoom,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
