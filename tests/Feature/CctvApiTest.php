<?php

namespace Tests\Feature;

use App\Models\CctvPoint;
use App\Models\User;
use Database\Seeders\CctvPointSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CctvApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_read_endpoints_return_cctv_data_without_authentication(): void
    {
        $cctv = CctvPoint::factory()->create([
            'name' => 'Simpang PDAM',
            'keterangan' => 'Great',
            'url' => null,
            'rec1x' => 10.5,
            'rec1y' => 20.5,
        ]);

        $this->get('/')->assertStatus(200);
        $this->get('/map')->assertStatus(200);
        $this->get('/table')->assertStatus(200);
        $this->get("/detail/{$cctv->id}")->assertStatus(200);
        $this->get("/detail/video/{$cctv->id}")->assertStatus(200);
        $this->get("/api/detail/{$cctv->id}")->assertStatus(200);

        $response = $this->getJson('/api/table');
        $response->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment([
                'id' => $cctv->id,
                'name' => 'Simpang PDAM',
                'keterangan' => 'Great',
                'url' => null,
                'rec1x' => 10.5,
                'rec1y' => 20.5,
            ]);
    }

    public function test_guest_and_non_admin_cannot_access_admin_pages_or_mutate_cctv(): void
    {
        $cctv = CctvPoint::factory()->create();
        $regularUser = User::factory()->create(['role' => 'user']);

        $this->get('/table/add')->assertRedirect('/login');
        $this->get("/table/edit/{$cctv->id}")->assertRedirect('/login');
        $this->postJson('/store', [])->assertStatus(401);
        $this->patchJson("/update/{$cctv->id}", [])->assertStatus(401);
        $this->deleteJson("/destroy/{$cctv->id}")->assertStatus(401);
        $this->postJson("/update/keterangan/{$cctv->id}", ['keterangan' => 'Great'])->assertStatus(401);
        $this->patchJson("/update/roi/{$cctv->id}", [])->assertStatus(401);
        $this->postJson("/api/traffic/{$cctv->id}", ['keterangan' => 'Great'])->assertStatus(401);

        $this->actingAs($regularUser);
        $this->get('/table/add')->assertStatus(403);
        $this->get("/table/edit/{$cctv->id}")->assertStatus(403);
        $this->postJson('/store', [])->assertStatus(403);
        $this->patchJson("/update/{$cctv->id}", [])->assertStatus(403);
        $this->deleteJson("/destroy/{$cctv->id}")->assertStatus(403);
        $this->postJson("/update/keterangan/{$cctv->id}", ['keterangan' => 'Great'])->assertStatus(403);
        $this->patchJson("/update/roi/{$cctv->id}", [])->assertStatus(403);

        Sanctum::actingAs($regularUser);
        $this->postJson("/api/traffic/{$cctv->id}", ['keterangan' => 'Great'])->assertStatus(403);
    }

    public function test_admin_can_crud_cctv_and_store_nullable_url_without_resetting_condition_to_low(): void
    {
        Storage::fake('public');
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin);

        $this->get('/table/add')->assertOk();

        $file = UploadedFile::fake()->image('camera.jpg', 300, 200);
        $this->postJson('/upload', ['image' => $file])->assertOk();
        Storage::disk('public')->assertExists('cctv/image/tmp.jpg');

        $storePayload = [
            'name' => 'Simpang Jambo Tape',
            'category' => 'Regular',
            'address' => 'Jl. T. Daud Beureueh',
            'lattitude' => '5.558700',
            'longitude' => '95.331500',
            'agency' => 'Dishub',
            'url' => null,
        ];

        $createRes = $this->postJson('/store', $storePayload)->assertStatus(201);
        $cctvId = $createRes->json('data.id');

        $this->assertDatabaseHas('cctv_points', [
            'id' => $cctvId,
            'name' => 'Simpang Jambo Tape',
            'url' => null,
            'keterangan' => 'No Data',
        ]);

        $this->get("/table/edit/{$cctvId}")->assertOk();

        $this->patchJson("/update/{$cctvId}", [
            'name' => 'Simpang Jambo Tape Updated',
            'category' => 'Analytic',
            'address' => 'Jl. T. Daud Beureueh',
            'lattitude' => '5.558700',
            'longitude' => '95.331500',
            'agency' => 'Dishub',
            'url' => '/assets/video/sample.mp4',
        ])->assertOk();

        $this->assertDatabaseHas('cctv_points', [
            'id' => $cctvId,
            'name' => 'Simpang Jambo Tape Updated',
            'keterangan' => 'Great',
        ]);

        $replacement = UploadedFile::fake()->image('replacement.png', 200, 200);
        $this->postJson("/uploadEdit/{$cctvId}", ['image' => $replacement])->assertOk();

        $this->deleteJson("/destroy/{$cctvId}")->assertOk();
        $this->assertDatabaseMissing('cctv_points', ['id' => $cctvId]);
    }

    public function test_admin_can_update_traffic_condition_and_roi_with_validation(): void
    {
        $admin = User::factory()->admin()->create();
        $cctv = CctvPoint::factory()->create(['keterangan' => 'Great']);

        $this->actingAs($admin);

        $this->postJson("/update/keterangan/{$cctv->id}", ['keterangan' => 'Low'])
            ->assertStatus(422);

        $this->postJson("/update/keterangan/{$cctv->id}", ['keterangan' => 'Poor'])
            ->assertOk()
            ->assertJson(['keterangan' => 'Poor']);

        Sanctum::actingAs($admin);
        $this->postJson("/api/traffic/{$cctv->id}", ['keterangan' => 'Terrible'])
            ->assertOk()
            ->assertJson(['keterangan' => 'Terrible']);

        $this->actingAs($admin);
        $roiPayload = [
            'rec1x' => 10,
            'rec1y' => 20,
            'rec2x' => 200,
            'rec2y' => 20,
            'rec3x' => 220,
            'rec3y' => 180,
            'rec4x' => 40,
            'rec4y' => 190,
            'rec5x' => 15,
            'rec5y' => 100,
        ];

        $this->patchJson("/update/roi/{$cctv->id}", $roiPayload)
            ->assertOk()
            ->assertJsonPath('data.rec4y', 190);

        $this->assertDatabaseHas('cctv_points', [
            'id' => $cctv->id,
            'keterangan' => 'Terrible',
            'rec4y' => 190,
        ]);
    }

    public function test_upload_rejects_non_image_files(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin);

        $invalidFile = UploadedFile::fake()->create('script.php', 10, 'application/x-php');
        $this->postJson('/upload', ['image' => $invalidFile])->assertStatus(422);
    }

    public function test_simulation_seeder_populates_video_urls_roi_and_renders_simulation_meta(): void
    {
        $this->seed(CctvPointSeeder::class);

        $pdam = CctvPoint::where('name', 'Simpang PDAM')->firstOrFail();
        $jambo = CctvPoint::where('name', 'Simpang Jambo Tape')->firstOrFail();

        $this->assertSame('/demo/videos/simpang-pdam.mp4', $pdam->url);
        $this->assertSame(195.0, (float) $pdam->rec1x);
        $this->assertSame('/demo/videos/simpang-jambo-tape.mp4', $jambo->url);
        $this->assertSame(250.0, (float) $jambo->rec1x);

        $homeResponse = $this->get('/');
        $homeResponse->assertOk()
            ->assertSee('name="webgista-simulation"', false)
            ->assertSee('SIMULASI DEMO', false)
            ->assertDontSee(env('DEMO_ADMIN_PASSWORD', 'password'), false);

        $this->get("/detail/video/{$pdam->id}")
            ->assertOk()
            ->assertSee('name="webgista-simulation"', false)
            ->assertSee('/demo/videos/simpang-pdam.mp4', false)
            ->assertSee('simpang-pdam.mp4', false);
    }
}
