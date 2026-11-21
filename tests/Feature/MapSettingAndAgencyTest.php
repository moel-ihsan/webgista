<?php

namespace Tests\Feature;

use App\Models\AgencyList;
use App\Models\MapSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MapSettingAndAgencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_can_read_map_settings_and_agencies(): void
    {
        MapSetting::factory()->create([
            'lattitude' => '5.552874',
            'longitude' => '95.327801',
            'zoom' => '13',
        ]);
        AgencyList::factory()->create(['agency' => 'Dishub']);

        $this->getJson('/api/setting')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['zoom' => '13']);

        $this->getJson('/api/agency')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['agency' => 'Dishub']);
    }

    public function test_guest_and_non_admin_cannot_modify_settings_or_agencies(): void
    {
        $setting = MapSetting::factory()->create();
        $agency = AgencyList::factory()->create(['agency' => 'Dishub']);
        $regularUser = User::factory()->create(['role' => 'user']);

        $this->get("/setting/{$setting->id}")->assertRedirect('/login');
        $this->postJson('/store/mapSetting', [])->assertStatus(401);
        $this->patchJson("/updateSetting/{$setting->id}", [])->assertStatus(401);
        $this->postJson('/store/agency', ['agency' => 'Polres'])->assertStatus(401);
        $this->deleteJson("/destroyAgent/{$agency->agency}")->assertStatus(401);

        $this->actingAs($regularUser);
        $this->get("/setting/{$setting->id}")->assertStatus(403);
        $this->postJson('/store/mapSetting', [])->assertStatus(403);
        $this->patchJson("/updateSetting/{$setting->id}", [])->assertStatus(403);
        $this->postJson('/store/agency', ['agency' => 'Polres'])->assertStatus(403);
        $this->deleteJson("/destroyAgent/{$agency->agency}")->assertStatus(403);
    }

    public function test_admin_can_manage_map_settings_and_agencies(): void
    {
        $admin = User::factory()->admin()->create();
        $setting = MapSetting::factory()->create([
            'lattitude' => '5.552874',
            'longitude' => '95.327801',
            'zoom' => '13',
        ]);

        $this->actingAs($admin);

        $this->get("/setting/{$setting->id}")->assertOk();

        $this->patchJson("/updateSetting/{$setting->id}", [
            'lattitude' => 5.560000,
            'longitude' => 95.340000,
            'zoom' => 15,
        ])->assertOk();

        $this->assertDatabaseHas('map_settings', [
            'id' => $setting->id,
            'zoom' => '15',
        ]);

        $this->postJson('/store/mapSetting', [
            'lattitude' => 5.55,
            'longitude' => 95.32,
            'zoom' => 14,
        ])->assertStatus(201);

        $this->postJson('/store/agency', ['agency' => 'Diskominfotik'])->assertStatus(201);
        $this->postJson('/store/agency', ['agency' => 'Diskominfotik'])->assertStatus(422);

        $this->deleteJson('/destroyAgent/Diskominfotik')->assertOk();
        $this->assertDatabaseMissing('agency_lists', ['agency' => 'Diskominfotik']);
    }
}
