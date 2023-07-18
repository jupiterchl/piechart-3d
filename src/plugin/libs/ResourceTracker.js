import * as THREE from 'three';

export default class ResourceTracker {
  constructor() {
    this.resources = new Set();
  }

  add(resource) {
    if (!resource) {
      return resource;
    }

    // handle children and when material is an array of materials or
    // uniform is array of textures
    if (Array.isArray(resource)) {
      resource.forEach((resource) => this.track(resource));
      return resource;
    }

    if (resource.dispose || resource instanceof THREE.Object3D) {
      this.resources.add(resource);
    }

    return resource;
  }

  remove(resource) {
    this.resources.delete(resource);
  }

  dispose(resource) {
    if (!resource) return;

    if (Array.isArray(resource)) {
      resource.forEach((resource) => this.dispose(resource));
      return;
    }

    if (resource instanceof THREE.Object3D) {
      this.dispose(resource.geometry);
      this.dispose(resource.material);
      this.dispose(resource.children);
    } else if (resource instanceof THREE.Material) {
      // We have to check if there are any textures on the material
      for (const value of Object.values(resource)) {
        if (value instanceof THREE.Texture) {
          this.dispose(value);
        }
      }
      // We also have to check if any uniforms reference textures or arrays of textures
      if (resource.uniforms) {
        for (const value of Object.values(resource.uniforms)) {
          if (value) {
            const uniformValue = value.value;
            if (uniformValue instanceof THREE.Texture || Array.isArray(uniformValue)) {
              this.dispose(uniformValue);
            }
          }
        }
      }
    }

    if (resource instanceof THREE.Object3D && resource.parent) {
      resource.parent.remove(resource);
    }

    if (resource.dispose) {
      resource.dispose();
    }

    if (this.resources.has(resource)) {
      this.resources.delete(resource);
    }
  }

  disposeAll() {
    this.resources.forEach(this.dispose.bind(this));
    this.resources.clear();
  }
}
