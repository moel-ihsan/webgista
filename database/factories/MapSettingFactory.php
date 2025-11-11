<?php

namespace Database\Factories;

use App\Models\MapSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

class MapSettingFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = MapSetting::class;

    /**
     * Define the model's default state.
     *
     * @return array
     */
    public function definition()
    {
        return [
            'lattitude' => $this->faker->latitude(5, 6),
            'longitude' => $this->faker->longitude(95, 96),
            'zoom' => 12       
        ];
    }
}
