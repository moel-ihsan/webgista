<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = User::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition()
    {
        return [
            'name' => $this->faker->name,
            'email' => $this->faker->unique()->safeEmail,
            'email_verified_at' => now(),
            'address' => $this->faker->address,
            'lattitude' => (string) $this->faker->latitude(5.5, 5.6),
            'longitude' => (string) $this->faker->longitude(95.3, 95.4),
            'description' => $this->faker->sentence,
            'profile_photo_path' => null,
            'role' => 'user',
            'password' => Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }

    /**
     * Configure the user as an administrator.
     *
     * @return static
     */
    public function admin()
    {
        return $this->state(function () {
            return [
                'role' => 'admin',
            ];
        });
    }
}
