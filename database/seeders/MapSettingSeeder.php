<?php

namespace Database\Seeders;

use App\Models\MapSetting;
use Illuminate\Database\Seeder;

class MapSettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        if (MapSetting::count() === 0) {
            MapSetting::create([
                'lattitude' => '5.552874',
                'longitude' => '95.327801',
                'zoom' => '13',
            ]);
        }
    }
}
