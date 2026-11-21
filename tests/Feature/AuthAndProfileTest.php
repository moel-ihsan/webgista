<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AuthAndProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_office_profile_sanitizes_sensitive_user_fields(): void
    {
        User::factory()->admin()->create([
            'name' => 'Diskominfotik Banda Aceh',
            'email' => 'private-admin@example.test',
        ]);

        $response = $this->getJson('/profileUser')->assertOk();

        $response->assertJsonPath('user.name', 'Diskominfotik Banda Aceh');
        $this->assertArrayNotHasKey('email', $response->json('user'));
        $this->assertArrayNotHasKey('password', $response->json('user'));
        $this->assertArrayNotHasKey('role', $response->json('user'));
    }

    public function test_login_auth_user_and_logout_flow(): void
    {
        $admin = User::factory()->admin()->create([
            'email' => 'admin@webgista.test',
            'password' => Hash::make('secret123'),
        ]);

        $this->getJson('/authUser')->assertOk()->assertExactJson(['user' => null]);

        $this->postJson('/login/enter', [
            'email' => 'admin@webgista.test',
            'password' => 'wrong-pass',
        ])->assertOk()->assertJson(['isAuth' => false]);

        $this->postJson('/login/enter', [
            'email' => 'admin@webgista.test',
            'password' => 'secret123',
        ])->assertOk()->assertJson(['isAuth' => true]);

        $this->getJson('/authUser')
            ->assertOk()
            ->assertJsonPath('user.id', $admin->id)
            ->assertJsonPath('user.role', 'admin');

        $this->get('/logout')->assertRedirect('/');
        $this->assertGuest();
    }

    public function test_admin_can_update_own_profile_avatar_and_password_and_idor_is_blocked(): void
    {
        Storage::fake('public');

        $admin = User::factory()->admin()->create([
            'email' => 'admin@webgista.test',
            'password' => Hash::make('oldpass123'),
        ]);
        $otherAdmin = User::factory()->admin()->create([
            'email' => 'other@webgista.test',
        ]);

        $this->actingAs($admin);

        $this->get("/profile/{$admin->id}")->assertOk();
        $this->get('/password')->assertOk();

        // IDOR attempts on another user must fail with 403
        $this->get("/profile/{$otherAdmin->id}")->assertStatus(403);
        $this->patchJson("/updateProfile/{$otherAdmin->id}", [
            'name' => 'Hijack',
            'address' => 'Test',
            'lattitude' => 5.5,
            'longitude' => 95.3,
            'description' => 'Desc',
        ])->assertStatus(403);
        $this->postJson("/changePassword/{$otherAdmin->id}", [
            'curPas' => 'password',
            'newPas' => 'newpass123',
            'confirm' => 'newpass123',
        ])->assertStatus(403);

        // Update own profile & avatar
        $this->patchJson("/updateProfile/{$admin->id}", [
            'name' => 'Dishub Banda Aceh',
            'address' => 'Jl. Merdeka',
            'lattitude' => 5.552874,
            'longitude' => 95.327801,
            'description' => 'Updated description',
        ])->assertOk();

        $this->assertDatabaseHas('users', [
            'id' => $admin->id,
            'name' => 'Dishub Banda Aceh',
        ]);

        $avatar = UploadedFile::fake()->image('avatar.jpg', 200, 200);
        $uploadRes = $this->postJson("/uploadEditProfile/{$admin->id}", ['image' => $avatar])->assertOk();
        $savedPath = str_replace('public/', '', $uploadRes->json('image'));
        Storage::disk('public')->assertExists($savedPath);

        // Wrong current password
        $this->postJson("/changePassword/{$admin->id}", [
            'curPas' => 'wrong-current',
            'newPas' => 'newpass123',
            'confirm' => 'newpass123',
        ])->assertOk()->assertJson(['status' => 404]);

        // Valid password change
        $this->postJson("/changePassword/{$admin->id}", [
            'curPas' => 'oldpass123',
            'newPas' => 'newpass123',
            'confirm' => 'newpass123',
        ])->assertOk()->assertJson(['status' => 200]);

        $this->assertTrue(Auth::validate([
            'email' => 'admin@webgista.test',
            'password' => 'newpass123',
        ]));
    }
}
