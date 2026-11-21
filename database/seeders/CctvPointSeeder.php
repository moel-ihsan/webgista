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
        $pdamSim = config('simulation.cameras.simpang-pdam', []);
        $jamboSim = config('simulation.cameras.simpang-jambo-tape', []);

        $samples = [
            array_merge([
                'name' => 'Simpang PDAM',
                'category' => 'Analytic',
                'address' => 'Jl. Teuku Nyak Arief (Arah Darussalam)',
                'lattitude' => '5.561200',
                'longitude' => '95.344800',
                'agency' => 'Dishub',
                'keterangan' => 'Great',
                'path_image' => 'tf1.jpg',
                'url' => $pdamSim['video_url'] ?? '/demo/videos/simpang-pdam.mp4',
            ], $pdamSim['default_roi'] ?? []),
            array_merge([
                'name' => 'Simpang Jambo Tape',
                'category' => 'Analytic',
                'address' => 'Jl. T. Daud Beureueh (Arah Simpang Lima)',
                'lattitude' => '5.558700',
                'longitude' => '95.331500',
                'agency' => 'Diskominfotik',
                'keterangan' => 'Average',
                'path_image' => 'tf2.jpg',
                'url' => $jamboSim['video_url'] ?? '/demo/videos/simpang-jambo-tape.mp4',
            ], $jamboSim['default_roi'] ?? []),
        ];

        foreach ($samples as $sample) {
            CctvPoint::updateOrCreate(['name' => $sample['name']], $sample);
        }
    }
}
