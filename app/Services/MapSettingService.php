<?php

namespace App\Services;

use App\Models\MapSetting;
use Illuminate\Database\Eloquent\Collection;

class MapSettingService
{
    /**
     * Retrieve all map settings ordered from newest to oldest.
     *
     * @return Collection<int, MapSetting>
     */
    public function listAll(): Collection
    {
        return MapSetting::latest()->get();
    }

    /**
     * Create a new map setting record.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): MapSetting
    {
        return MapSetting::create($data);
    }

    /**
     * Update an existing map setting record.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(MapSetting $mapSetting, array $data): MapSetting
    {
        $mapSetting->update($data);

        return $mapSetting->fresh();
    }
}
