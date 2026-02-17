export namespace main {
	
	export class Vec2 {
	    x: number;
	    y: number;
	
	    static createFrom(source: any = {}) {
	        return new Vec2(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.x = source["x"];
	        this.y = source["y"];
	    }
	}
	export class Point {
	    x: number;
	    y: number;
	    h1: Vec2;
	    h2: Vec2;
	    isCurve: boolean;
	    handles?: Vec2[];
	
	    static createFrom(source: any = {}) {
	        return new Point(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.x = source["x"];
	        this.y = source["y"];
	        this.h1 = this.convertValues(source["h1"], Vec2);
	        this.h2 = this.convertValues(source["h2"], Vec2);
	        this.isCurve = source["isCurve"];
	        this.handles = this.convertValues(source["handles"], Vec2);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Entity {
	    type: string;
	    layer: string;
	    color: string;
	    points?: Point[];
	    cx?: number;
	    cy?: number;
	    rx?: number;
	    ry?: number;
	    startAngle?: number;
	    endAngle?: number;
	    arcMode?: string;
	    rotation?: number;
	    x?: number;
	    y?: number;
	    w?: number;
	    h?: number;
	    text?: string;
	    fontSize?: number;
	
	    static createFrom(source: any = {}) {
	        return new Entity(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.layer = source["layer"];
	        this.color = source["color"];
	        this.points = this.convertValues(source["points"], Point);
	        this.cx = source["cx"];
	        this.cy = source["cy"];
	        this.rx = source["rx"];
	        this.ry = source["ry"];
	        this.startAngle = source["startAngle"];
	        this.endAngle = source["endAngle"];
	        this.arcMode = source["arcMode"];
	        this.rotation = source["rotation"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.w = source["w"];
	        this.h = source["h"];
	        this.text = source["text"];
	        this.fontSize = source["fontSize"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Asset {
	    id: string;
	    name: string;
	    type: string;
	    w: number;
	    h: number;
	    color: string;
	    entities: Entity[];
	    isDefaultShape?: boolean;
	    snap?: boolean;
	    boundX?: number;
	    boundY?: number;
	
	    static createFrom(source: any = {}) {
	        return new Asset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.w = source["w"];
	        this.h = source["h"];
	        this.color = source["color"];
	        this.entities = this.convertValues(source["entities"], Entity);
	        this.isDefaultShape = source["isDefaultShape"];
	        this.snap = source["snap"];
	        this.boundX = source["boundX"];
	        this.boundY = source["boundY"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Instance {
	    id: string;
	    assetId?: string;
	    type: string;
	    x: number;
	    y: number;
	    rotation: number;
	    locked: boolean;
	    text?: string;
	    fontSize?: number;
	    color?: string;
	
	    static createFrom(source: any = {}) {
	        return new Instance(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.assetId = source["assetId"];
	        this.type = source["type"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.rotation = source["rotation"];
	        this.locked = source["locked"];
	        this.text = source["text"];
	        this.fontSize = source["fontSize"];
	        this.color = source["color"];
	    }
	}
	
	export class Project {
	    id: string;
	    name: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class ProjectData {
	    assets: Asset[];
	    instances: Instance[];
	    defaultColors?: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new ProjectData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.assets = this.convertValues(source["assets"], Asset);
	        this.instances = this.convertValues(source["instances"], Instance);
	        this.defaultColors = source["defaultColors"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

