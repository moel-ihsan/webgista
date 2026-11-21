<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CctvPointResource extends JsonResource
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
            'name' => $this->name,
            'category' => $this->category,
            'address' => $this->address,
            'lattitude' => $this->lattitude,
            'longitude' => $this->longitude,
            'agency' => $this->agency,
            'keterangan' => $this->keterangan,
            'path_image' => $this->path_image,
            'url' => $this->url,
            'rec1x' => $this->rec1x,
            'rec1y' => $this->rec1y,
            'rec2x' => $this->rec2x,
            'rec2y' => $this->rec2y,
            'rec3x' => $this->rec3x,
            'rec3y' => $this->rec3y,
            'rec4x' => $this->rec4x,
            'rec4y' => $this->rec4y,
            'rec5x' => $this->rec5x,
            'rec5y' => $this->rec5y,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
