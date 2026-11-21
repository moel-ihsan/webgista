<?php

namespace Database\Seeders;

use App\Models\CctvPoint;
use Illuminate\Database\Seeder;

class CctvPointSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $samples = [
            [
                'name' => 'Simpang PDAM',
                'category' => 'Analytic',
                'address' => 'Jl. Teuku Nyak Arief (Arah Darussalam)',
                'lattitude' => '5.561200',
                'longitude' => '95.344800',
                'agency' => 'Dishub',
                'keterangan' => 'Great',
                'path_image' => 'tf1.jpg',
                'url' => null,
            ],
            [
                'name' => 'Simpang Jambo Tape',
                'category' => 'Analytic',
                'address' => 'Jl. T. Daud Beureueh (Arah Simpang Lima)',
                'lattitude' => '5.558700',
                'longitude' => '95.331500',
                'agency' => 'Diskominfotik',
                'keterangan' => 'Average',
                'path_image' => 'tf2.jpg',
                'url' => null,
            ],
        ];

        foreach ($samples as $sample) {
            CctvPoint::firstOrCreate(['name' => $sample['name']], $sample);
        }
    }
}
